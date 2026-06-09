package com.example.digitalsignage

import android.util.Log
import com.hierynomus.msdtyp.AccessMask
import com.hierynomus.mssmb2.SMB2CreateDisposition
import com.hierynomus.mssmb2.SMB2ShareAccess
import com.hierynomus.smbj.SMBClient
import com.hierynomus.smbj.auth.AuthenticationContext
import com.hierynomus.smbj.share.DiskShare
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.util.Calendar
import java.util.EnumSet

@Serializable
data class PlaylistItem(
    val layout: String? = null,
    val file: String? = null,
    val main_file: String? = null,
    val sidebar_file: String? = null,
    val ticker_text: String? = null,
    val duration: Int? = null,
    val schedule: String? = null,
    val days: String? = null,
    val zoom: Int? = null,
    val sidebar_zoom: Int? = null
)

data class ActivePlaylistItem(
    val layout: String,
    val mainFile: File?,
    val sidebarFile: File?,
    val tickerText: String,
    val durationSeconds: Int,
    val isVideo: Boolean,
    val zoomPercent: Int,
    val sidebarZoomPercent: Int
)

object SMBHelper {
    private const val TAG = "SMBHelper"

    // Test a connection to verify credentials. Returns true or throws descriptive error.
    fun testConnection(ip: String, shareName: String, user: String, pass: String) {
        val client = SMBClient()
        try {
            val connection = try {
                client.connect(ip)
            } catch (e: Exception) {
                throw Exception("No se pudo conectar a la IP $ip. Verifica la red.", e)
            }

            connection.use { conn ->
                val session = try {
                    val authContext = AuthenticationContext(user, pass.toCharArray(), null)
                    conn.authenticate(authContext)
                } catch (e: Exception) {
                    throw Exception("Credenciales incorrectas para el usuario '$user'.", e)
                }

                try {
                    session.connectShare(shareName).use { }
                } catch (e: Exception) {
                    throw Exception("No se pudo abrir la carpeta '$shareName'. Verifica el nombre del recurso compartido.", e)
                }
            }
        } finally {
            try {
                client.close()
            } catch (e: Exception) { }
        }
    }

    fun syncAndGetMediaFiles(
        ip: String,
        shareName: String,
        user: String,
        pass: String,
        cacheDir: File,
        onStatusUpdate: (String) -> Unit
    ): List<ActivePlaylistItem> {
        val client = SMBClient()
        try {
            onStatusUpdate("Conectando al servidor $ip...")
            val connection = try {
                client.connect(ip)
            } catch (e: Exception) {
                throw Exception("Error de red: No se pudo conectar a $ip. ¿Está encendido el servidor y en la misma red?", e)
            }

            connection.use { conn ->
                onStatusUpdate("Autenticando como '$user'...")
                val session = try {
                    val authContext = AuthenticationContext(user, pass.toCharArray(), null)
                    conn.authenticate(authContext)
                } catch (e: Exception) {
                    throw Exception("Error de autenticación: Credenciales incorrectas para el usuario '$user'.", e)
                }

                onStatusUpdate("Conectando a la carpeta compartida '$shareName'...")
                val share = try {
                    session.connectShare(shareName) as DiskShare
                } catch (e: Exception) {
                    throw Exception("Error de recurso: No se pudo abrir '$shareName'. Verifica el nombre del recurso compartido.", e)
                }

                val playlistPath = "playlist.json"
                var playlistContent = readTextFromSMB(share, playlistPath)

                // If playlist.json does not exist in root, scan root and generate a default one
                if (playlistContent == null) {
                    onStatusUpdate("Generando playlist.json por defecto...")
                    val files = try {
                        share.list("")
                    } catch (e: Exception) {
                        emptyList()
                    }

                    val defaultItems = files.filter { fileInfo ->
                        val name = fileInfo.fileName
                        val isDir = (fileInfo.fileAttributes and 0x10L) != 0L
                        val isMedia = name.endsWith(".png", ignoreCase = true) ||
                                name.endsWith(".jpg", ignoreCase = true) ||
                                name.endsWith(".jpeg", ignoreCase = true) ||
                                name.endsWith(".webp", ignoreCase = true) ||
                                name.endsWith(".mp4", ignoreCase = true) ||
                                name.endsWith(".mkv", ignoreCase = true) ||
                                name.endsWith(".avi", ignoreCase = true)

                        !name.startsWith(".") && !isDir && isMedia && name != "playlist.json"
                    }.map { fileInfo ->
                        val isVideo = isVideoFile(fileInfo.fileName)
                        PlaylistItem(
                            layout = "fullscreen",
                            file = fileInfo.fileName,
                            main_file = fileInfo.fileName,
                            duration = if (isVideo) null else 12,
                            schedule = null,
                            days = null
                        )
                    }

                    if (defaultItems.isNotEmpty()) {
                        try {
                            val json = Json { prettyPrint = true }
                            val jsonText = json.encodeToString(defaultItems)
                            writeTextToSMB(share, playlistPath, jsonText)
                            playlistContent = jsonText
                        } catch (e: Exception) {
                            Log.e(TAG, "Error writing default playlist.json", e)
                        }
                    }
                }

                if (playlistContent == null) {
                    throw Exception("Lista de reproducción vacía: No se encontró playlist.json ni archivos multimedia en la carpeta raíz.")
                }

                // Sanitize the content (remove BOM, leading/trailing whitespace)
                var sanitizedContent = playlistContent.trim()
                if (sanitizedContent.startsWith("\uFEFF")) {
                    sanitizedContent = sanitizedContent.substring(1).trim()
                }

                // Parse playlist.json with a lenient configuration
                val leniencyJson = Json {
                    ignoreUnknownKeys = true
                    coerceInputValues = true
                    explicitNulls = true
                }
                val items = try {
                    leniencyJson.decodeFromString<List<PlaylistItem>>(sanitizedContent)
                } catch (e: Exception) {
                    val preview = if (sanitizedContent.length > 100) sanitizedContent.take(100) + "..." else sanitizedContent
                    throw Exception("Error de lectura: El archivo playlist.json tiene un formato incorrecto. Detalle: ${e.message}. Inicio del archivo: '$preview'", e)
                }

                // Filter active items based on schedule and day of the week
                val activeItems = items.filter { item ->
                    val isScheduled = item.schedule?.let { isCurrentTimeBetween(it) } ?: true
                    val isDayMatch = item.days?.let { isCurrentDayMatch(it) } ?: true
                    isScheduled && isDayMatch
                }

                if (activeItems.isEmpty()) {
                    throw Exception("Sin elementos activos: Ninguno de los elementos en playlist.json coincide con el horario y día actual.")
                }

                // Check directory files on the server to cross-reference sizes
                val files = try {
                    share.list("")
                } catch (e: Exception) {
                    throw Exception("Error al leer la lista de archivos del servidor.", e)
                }

                // Use case-insensitive mapping for filenames
                val remoteFileMap = files.associateBy { it.fileName.lowercase() }
                val localFiles = mutableListOf<ActivePlaylistItem>()
                val activeNamesLower = mutableSetOf<String>()

                fun getOrDownloadFile(fileName: String?, itemIndex: Int, totalItems: Int): File? {
                    if (fileName.isNullOrEmpty()) return null
                    val fileInfo = remoteFileMap[fileName.lowercase()]
                    if (fileInfo == null) {
                        Log.w(TAG, "El archivo listado no existe en el servidor: $fileName")
                        return null
                    }
                    val exactRemoteFileName = fileInfo.fileName
                    activeNamesLower.add(exactRemoteFileName.lowercase())
                    val localFile = File(cacheDir, exactRemoteFileName)
                    val remoteFileSize = fileInfo.endOfFile

                    if (localFile.exists() && localFile.length() == remoteFileSize) {
                        return localFile
                    }

                    onStatusUpdate("Descargando [${itemIndex + 1}/$totalItems]: '$exactRemoteFileName'...")
                    try {
                        share.openFile(
                            exactRemoteFileName,
                            EnumSet.of(AccessMask.GENERIC_READ),
                            null,
                            EnumSet.of(SMB2ShareAccess.FILE_SHARE_READ, SMB2ShareAccess.FILE_SHARE_WRITE),
                            SMB2CreateDisposition.FILE_OPEN,
                            null
                        ).use { smbFile ->
                            smbFile.inputStream.use { input ->
                                FileOutputStream(localFile).use { output ->
                                    input.copyTo(output)
                                }
                            }
                        }
                        return localFile
                    } catch (e: Exception) {
                        Log.e(TAG, "Error descargando $exactRemoteFileName", e)
                        return null
                    }
                }

                activeItems.forEachIndexed { index, item ->
                    val layout = item.layout ?: "fullscreen"
                    val mainFileName = item.main_file ?: item.file
                    val sidebarFileName = item.sidebar_file
                    val tickerText = item.ticker_text ?: ""
                    val duration = item.duration ?: 12

                    val mainFile = getOrDownloadFile(mainFileName, index, activeItems.size)
                    val sidebarFile = getOrDownloadFile(sidebarFileName, index, activeItems.size)
                    
                    val isVideo = mainFileName?.let { isVideoFile(it) } ?: false

                    if (mainFile != null || mainFileName == null) {
                        localFiles.add(
                            ActivePlaylistItem(
                                layout = layout,
                                mainFile = mainFile,
                                sidebarFile = sidebarFile,
                                tickerText = tickerText,
                                durationSeconds = duration,
                                isVideo = isVideo,
                                zoomPercent = item.zoom ?: 100,
                                sidebarZoomPercent = item.sidebar_zoom ?: 100
                            )
                        )
                    }
                }

                if (localFiles.isEmpty()) {
                    throw Exception("Error de descarga: No se pudo descargar ninguno de los archivos de la lista.")
                }

                // Delete local files no longer in active playlist (case-insensitive)
                cacheDir.listFiles()?.forEach { localFile ->
                    val localNameLower = localFile.name.lowercase()
                    if (localNameLower !in activeNamesLower && localFile.name != "playlist.json") {
                        try {
                            localFile.delete()
                            Log.d(TAG, "Deleted old cached file: ${localFile.name}")
                        } catch (e: Exception) {
                            Log.e(TAG, "Error deleting local file ${localFile.name}", e)
                        }
                    }
                }

                onStatusUpdate("Sincronización completa. Iniciando lista...")
                return localFiles
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in SMB operations, trying fallback to cache...", e)
            val cached = getFallbackCachedFiles(cacheDir)
            if (cached.isNotEmpty()) {
                return cached
            }
            throw e
        } finally {
            try {
                client.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error closing SMB client", e)
            }
        }
    }

    private fun readTextFromSMB(share: DiskShare, relativePath: String): String? {
        if (!share.fileExists(relativePath)) return null
        return try {
            share.openFile(
                relativePath,
                EnumSet.of(AccessMask.GENERIC_READ),
                null,
                EnumSet.of(SMB2ShareAccess.FILE_SHARE_READ, SMB2ShareAccess.FILE_SHARE_WRITE),
                SMB2CreateDisposition.FILE_OPEN,
                null
            ).use { smbFile ->
                smbFile.inputStream.use { input ->
                    input.bufferedReader(Charsets.UTF_8).readText()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading file $relativePath", e)
            null
        }
    }

    private fun writeTextToSMB(share: DiskShare, relativePath: String, text: String) {
        share.openFile(
            relativePath,
            EnumSet.of(AccessMask.GENERIC_WRITE, AccessMask.GENERIC_READ),
            null,
            EnumSet.of(SMB2ShareAccess.FILE_SHARE_READ, SMB2ShareAccess.FILE_SHARE_WRITE),
            SMB2CreateDisposition.FILE_OVERWRITE_IF,
            null
        ).use { smbFile ->
            smbFile.outputStream.use { output ->
                output.write(text.toByteArray(Charsets.UTF_8))
            }
        }
    }

    private fun isCurrentTimeBetween(rangeStr: String): Boolean {
        try {
            val parts = rangeStr.split("-")
            if (parts.size != 2) return false

            val startStr = parts[0].trim()
            val endStr = parts[1].trim()

            val now = Calendar.getInstance()
            val currentMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

            val startParts = startStr.split(":")
            val startMin = startParts[0].trim().toInt() * 60 + startParts[1].trim().toInt()

            val endParts = endStr.split(":")
            val endMin = endParts[0].trim().toInt() * 60 + endParts[1].trim().toInt()

            return currentMin in startMin..endMin
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing time comparison for range $rangeStr", e)
            return false
        }
    }

    private fun isCurrentDayMatch(daysStr: String): Boolean {
        try {
            val now = Calendar.getInstance()
            val dayOfWeek = now.get(Calendar.DAY_OF_WEEK)

            val dayNames = when (dayOfWeek) {
                Calendar.SUNDAY -> listOf("sun", "sunday", "dom", "domingo", "1")
                Calendar.MONDAY -> listOf("mon", "monday", "lun", "lunes", "2")
                Calendar.TUESDAY -> listOf("tue", "tuesday", "mar", "martes", "3")
                Calendar.WEDNESDAY -> listOf("wed", "wednesday", "mie", "miercoles", "miércoles", "4")
                Calendar.THURSDAY -> listOf("thu", "thursday", "jue", "jueves", "5")
                Calendar.FRIDAY -> listOf("fri", "friday", "vie", "viernes", "6")
                Calendar.SATURDAY -> listOf("sat", "saturday", "sab", "sabado", "sábado", "7")
                else -> emptyList()
            }

            val configDays = daysStr.split(",").map { it.trim().lowercase() }
            return configDays.any { it in dayNames }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing days $daysStr", e)
            return false
        }
    }

    private fun getFallbackCachedFiles(cacheDir: File): List<ActivePlaylistItem> {
        Log.d(TAG, "Attempting to get fallback from cache...")
        return (cacheDir.listFiles()?.filter {
            val name = it.name
            name.endsWith(".png", ignoreCase = true) ||
                    name.endsWith(".jpg", ignoreCase = true) ||
                    name.endsWith(".jpeg", ignoreCase = true) ||
                    name.endsWith(".webp", ignoreCase = true) ||
                    name.endsWith(".mp4", ignoreCase = true) ||
                    name.endsWith(".mkv", ignoreCase = true) ||
                    name.endsWith(".avi", ignoreCase = true)
        } ?: emptyList()).map {
            ActivePlaylistItem(
                layout = "fullscreen",
                mainFile = it,
                sidebarFile = null,
                tickerText = "",
                durationSeconds = 12,
                isVideo = isVideoFile(it.name),
                zoomPercent = 100,
                sidebarZoomPercent = 100
            )
        }.sortedBy { it.mainFile?.name ?: "" }
    }

    private fun isVideoFile(name: String): Boolean {
        return name.endsWith(".mp4", ignoreCase = true) ||
                name.endsWith(".mkv", ignoreCase = true) ||
                name.endsWith(".avi", ignoreCase = true)
    }
}
