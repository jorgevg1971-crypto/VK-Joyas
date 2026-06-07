package com.example.digitalsignage.ui.setup

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun SetupScreen(onFolderSelected: (String) -> Unit) {
    val folders = listOf(
        "PB" to "PB",
        "Piso1" to "Piso 1",
        "Piso2" to "Piso 2",
        "Piso3" to "Piso 3",
        "RAIZ" to "Todos"
    )

    val firstItemFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        delay(300)
        firstItemFocusRequester.requestFocus()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121212)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "CONFIGURACIÓN DE PANTALLA",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Seleccione la ubicación de donde cargar el contenido de Digital Signage",
                fontSize = 16.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 40.dp)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .focusGroup(),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally)
            ) {
                folders.forEachIndexed { index, pair ->
                    var isFocused by remember { mutableStateOf(false) }

                    Button(
                        onClick = { onFolderSelected(pair.first) },
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isFocused) Color(0xFFE50914) else Color(0xFF222222),
                            contentColor = Color.White
                        ),
                        border = BorderStroke(
                            width = 3.dp,
                            color = if (isFocused) Color.White else Color.Transparent
                        ),
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier
                            .width(150.dp)
                            .height(110.dp)
                            .onFocusChanged { isFocused = it.isFocused }
                            .let { modifier ->
                                if (index == 0) modifier.focusRequester(firstItemFocusRequester) else modifier
                            }
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = pair.second,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
