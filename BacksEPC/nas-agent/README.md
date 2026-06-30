# Agente de Consolidación ePC Backups para QNAP NAS

Este agente permite ejecutar la consolidación y compresión de copias de seguridad de forma nativa directamente en tu servidor NAS QNAP, evitando descargar y subir gigabytes de datos a través de la red local.

---

## 🛠️ Instalación en QNAP TS-251D (Container Station)

La forma más rápida y segura de instalar el agente en tu NAS QNAP es utilizando **Container Station** (Docker).

### Paso 1: Subir la carpeta del Agente al QNAP
Copia la carpeta `nas-agent` del instalador a cualquier ubicación de tu NAS (por ejemplo, en una carpeta compartida llamada `Public` o `Admin`).

### Paso 2: Crear el Contenedor en Container Station
1. Abre **Container Station** en la interfaz web de tu QNAP (QTS).
2. Ve a **Imágenes** -> Haz clic en **Crear** o **Importar** para compilar el contenedor a partir del `Dockerfile` provisto.
3. O si prefieres usar la línea de comandos SSH de tu QNAP, navega hasta la carpeta `nas-agent` y ejecuta:
   ```bash
   docker build -t epc-backup-nas-agent .
   ```

### Paso 3: Configurar el Contenedor (Puntos Clave)
Al crear o iniciar el contenedor en Container Station, asegúrate de establecer la siguiente configuración:

1. **Configuración de Red (Puertos)**:
   * Publicar puerto del contenedor **`8283`** al puerto del host **`8283`** (TCP).

2. **Montaje de Volúmenes (Carpetas Compartidas)**:
   * Debes montar la carpeta compartida donde guardas todos tus backups en el contenedor.
   * **Ruta del Host (QNAP)**: La carpeta compartida de tus copias (ej. `/share/Backups`).
   * **Ruta de Destino (Contenedor)**: Debe montarse exactamente en **`/backups`**.

3. **Variables de Entorno**:
   * Asegúrate de que la variable `BACKUP_ROOT_PATH` esté establecida en `/backups` (ya viene por defecto en el Dockerfile).

### Paso 4: Iniciar y Listo
Inicia el contenedor. Puedes verificar que está corriendo ingresando desde cualquier navegador de tu red a:
👉 `http://[IP-DE-TU-NAS]:8283/api/health`

Debería devolver un mensaje indicando `"status": "online"`. El motor de las PCs clientes ahora detectará automáticamente el puerto `8283` en la IP de tu NAS y le delegará las tareas de consolidación directamente.
