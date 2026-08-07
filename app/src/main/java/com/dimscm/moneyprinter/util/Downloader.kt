package com.dimscm.moneyprinter.util

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment

/**
 * Hands a finished render to the system download manager so it lands in Movies/MoneyPrinter and
 * shows up in the gallery.
 */
object Downloader {

    private const val SUBDIRECTORY = "MoneyPrinter"

    fun enqueue(context: Context, url: String, apiKey: String, taskId: String): Long {
        val uri = Uri.parse(url)
        val name = uri.lastPathSegment?.takeIf { it.isNotBlank() } ?: "video.mp4"
        val fileName = if (name.startsWith(taskId)) name else "${taskId.take(8)}-$name"

        val request = DownloadManager.Request(uri)
            .setTitle(fileName)
            .setMimeType("video/mp4")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_MOVIES, "$SUBDIRECTORY/$fileName")
        if (apiKey.isNotBlank()) {
            request.addRequestHeader("x-api-key", apiKey)
        }

        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        return manager.enqueue(request)
    }
}
