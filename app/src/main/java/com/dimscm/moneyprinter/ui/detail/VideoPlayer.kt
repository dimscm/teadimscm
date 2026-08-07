package com.dimscm.moneyprinter.ui.detail

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView

/**
 * Streams a finished render straight from the server, forwarding the `x-api-key` header so a
 * protected instance still plays.
 */
// media3 marks these APIs with androidx.annotation.RequiresOptIn, so this is androidx's OptIn,
// not kotlin.OptIn.
@androidx.annotation.OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(
    url: String,
    apiKey: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val exoPlayer = remember(url, apiKey) {
        val httpFactory = DefaultHttpDataSource.Factory().apply {
            setAllowCrossProtocolRedirects(true)
            if (apiKey.isNotBlank()) {
                setDefaultRequestProperties(mapOf("x-api-key" to apiKey))
            }
        }
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(context).setDataSourceFactory(httpFactory))
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(url))
                prepare()
            }
    }

    DisposableEffect(exoPlayer) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = true
            }
        },
        update = { view -> view.player = exoPlayer },
    )
}
