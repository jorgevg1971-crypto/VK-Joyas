package com.example.digitalsignage.ui.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.digitalsignage.SMBHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SetupScreen(onSetupComplete: (String, String, String, String) -> Unit) {
    var ip by remember { mutableStateOf("192.168.0.10") }
    var share by remember { mutableStateOf("compartido") }
    var user by remember { mutableStateOf("ePC") }
    var pass by remember { mutableStateOf("3000:1*2-3000:1") }

    var isConnecting by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()
    val ipFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        ipFocusRequester.requestFocus()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121212)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .width(480.dp)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "CONFIGURACIÓN DE RED",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Ingrese los datos de conexión para el recurso compartido",
                fontSize = 13.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // IP Input
            OutlinedTextField(
                value = ip,
                onValueChange = { ip = it },
                label = { Text("Dirección IP") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFE50914),
                    unfocusedBorderColor = Color.DarkGray,
                    focusedLabelColor = Color(0xFFE50914),
                    unfocusedLabelColor = Color.Gray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(ipFocusRequester)
                    .padding(bottom = 8.dp)
            )

            // Share Name Input
            OutlinedTextField(
                value = share,
                onValueChange = { share = it },
                label = { Text("Nombre de Carpeta Compartida") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFE50914),
                    unfocusedBorderColor = Color.DarkGray,
                    focusedLabelColor = Color(0xFFE50914),
                    unfocusedLabelColor = Color.Gray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
            )

            // Username Input
            OutlinedTextField(
                value = user,
                onValueChange = { user = it },
                label = { Text("Usuario") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFE50914),
                    unfocusedBorderColor = Color.DarkGray,
                    focusedLabelColor = Color(0xFFE50914),
                    unfocusedLabelColor = Color.Gray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
            )

            // Password Input
            OutlinedTextField(
                value = pass,
                onValueChange = { pass = it },
                label = { Text("Contraseña") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFFE50914),
                    unfocusedBorderColor = Color.DarkGray,
                    focusedLabelColor = Color(0xFFE50914),
                    unfocusedLabelColor = Color.Gray,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp)
            )

            if (isConnecting) {
                CircularProgressIndicator(color = Color(0xFFE50914), modifier = Modifier.size(36.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(statusMessage, color = Color.Gray, fontSize = 13.sp)
            } else {
                errorMessage?.let { error ->
                    Text(
                        text = error,
                        color = Color.Red,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                var isBtnFocused by remember { mutableStateOf(false) }
                Button(
                    onClick = {
                        isConnecting = true
                        errorMessage = null
                        statusMessage = "Probando conexión..."
                        scope.launch {
                            try {
                                withContext(Dispatchers.IO) {
                                    SMBHelper.testConnection(ip, share, user, pass)
                                }
                                isConnecting = false
                                onSetupComplete(ip, share, user, pass)
                            } catch (e: Exception) {
                                isConnecting = false
                                errorMessage = e.message ?: "Error al probar conexión."
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isBtnFocused) Color(0xFFE50914) else Color(0xFF222222),
                        contentColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .onFocusChanged { isBtnFocused = it.isFocused }
                        .border(
                            width = 2.dp,
                            color = if (isBtnFocused) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(12.dp)
                        )
                ) {
                    Text("Conectar y Guardar", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
