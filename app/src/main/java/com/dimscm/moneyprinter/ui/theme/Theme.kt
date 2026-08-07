package com.dimscm.moneyprinter.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = Color(0xFF1B6B45),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFA5F2C6),
    onPrimaryContainer = Color(0xFF002110),
    secondary = Color(0xFF4E6355),
    tertiary = Color(0xFF3C6472),
    background = Color(0xFFFBFDF8),
    surface = Color(0xFFFBFDF8),
    surfaceVariant = Color(0xFFDCE5DC),
    error = Color(0xFFBA1A1A),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF89D6AB),
    onPrimary = Color(0xFF003920),
    primaryContainer = Color(0xFF005230),
    onPrimaryContainer = Color(0xFFA5F2C6),
    secondary = Color(0xFFB4CCBB),
    tertiary = Color(0xFFA4CDDE),
    background = Color(0xFF101410),
    surface = Color(0xFF101410),
    surfaceVariant = Color(0xFF404943),
    error = Color(0xFFFFB4AB),
)

@Composable
fun MoneyPrinterTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
