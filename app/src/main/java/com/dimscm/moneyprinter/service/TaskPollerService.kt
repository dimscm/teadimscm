package com.dimscm.moneyprinter.service

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.dimscm.moneyprinter.MainActivity
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.di.ServiceLocator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Shows render progress in the status bar while tasks are running on the server.
 *
 * The service does not poll itself — [com.dimscm.moneyprinter.data.TaskWatcher] owns the loop and
 * this class only mirrors its state into notifications, so progress survives leaving the app.
 */
class TaskPollerService : Service() {

    private val scope = CoroutineScope(SupervisorJob())
    private var collectJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startInForeground(buildProgressNotification(0, 0))
        observeWatcher()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    override fun onDestroy() {
        collectJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun observeWatcher() {
        if (collectJob?.isActive == true) return
        val watcher = ServiceLocator.taskWatcher
        collectJob = scope.launch {
            launch {
                watcher.tasks.collect {
                    val active = watcher.activeTasks
                    if (active.isEmpty()) {
                        stopSelf()
                    } else {
                        notify(PROGRESS_NOTIFICATION_ID, buildProgressNotification(active.size, watcher.overallProgress))
                    }
                }
            }
            launch {
                watcher.finished.collect { finished ->
                    notify(finished.taskId.hashCode(), buildFinishedNotification(finished.taskId, finished.failed))
                }
            }
        }
    }

    private fun startInForeground(notification: android.app.Notification) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        } else {
            0
        }
        ServiceCompat.startForeground(this, PROGRESS_NOTIFICATION_ID, notification, type)
    }

    private fun buildProgressNotification(activeCount: Int, progress: Int): android.app.Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_video)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text, activeCount, progress))
            .setProgress(100, progress, progress <= 0)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openAppIntent())
            .build()

    private fun buildFinishedNotification(taskId: String, failed: Boolean): android.app.Notification {
        val shortId = taskId.take(8)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_video)
            .setContentTitle(getString(if (failed) R.string.notif_failed_title else R.string.notif_done_title))
            .setContentText(getString(if (failed) R.string.notif_failed_text else R.string.notif_done_text, shortId))
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
    }

    private fun openAppIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java)
            .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun notify(id: Int, notification: android.app.Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        NotificationManagerCompat.from(this).notify(id, notification)
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply { description = getString(R.string.notif_channel_desc) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private companion object {
        const val CHANNEL_ID = "render_progress"
        const val PROGRESS_NOTIFICATION_ID = 1001
    }
}
