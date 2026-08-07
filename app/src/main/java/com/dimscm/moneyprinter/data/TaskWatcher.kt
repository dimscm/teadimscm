package com.dimscm.moneyprinter.data

import android.content.Context
import android.content.Intent
import android.os.Build
import com.dimscm.moneyprinter.data.remote.TaskStatus
import com.dimscm.moneyprinter.service.TaskPollerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Keeps polling the server for every task that has not finished yet.
 *
 * Rendering takes minutes, so the poll loop lives outside the UI: screens observe [tasks], and a
 * foreground service mirrors the same state into a notification while the app is in the background.
 */
class TaskWatcher(
    private val context: Context,
    private val repository: MoneyPrinterRepository,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob()),
) {

    data class Finished(val taskId: String, val failed: Boolean)

    private val _tasks = MutableStateFlow<Map<String, TaskStatus>>(emptyMap())
    val tasks: StateFlow<Map<String, TaskStatus>> = _tasks.asStateFlow()

    private val _finished = MutableSharedFlow<Finished>(extraBufferCapacity = 16)
    val finished: SharedFlow<Finished> = _finished.asSharedFlow()

    private val watched = mutableSetOf<String>()
    private var pollJob: Job? = null

    val activeTasks: List<TaskStatus>
        get() = _tasks.value.values.filter { !it.isTerminal }

    /** 0..100 across everything currently rendering. */
    val overallProgress: Int
        get() {
            val active = activeTasks
            return if (active.isEmpty()) 0 else active.sumOf { it.progress } / active.size
        }

    @Synchronized
    fun watch(taskId: String) {
        if (taskId.isBlank()) return
        watched += taskId
        _tasks.update { current ->
            if (current.containsKey(taskId)) current
            else current + (taskId to TaskStatus(taskId = taskId, state = TaskStatus.STATE_PROCESSING))
        }
        ensurePolling()
    }

    /** Feeds a freshly fetched list into the cache and picks up anything still rendering. */
    @Synchronized
    fun merge(statuses: List<TaskStatus>) {
        _tasks.update { current ->
            current + statuses.filter { it.taskId.isNotBlank() }.associateBy { it.taskId }
        }
        statuses.filter { it.taskId.isNotBlank() && !it.isTerminal }.forEach { watched += it.taskId }
        if (watched.isNotEmpty()) ensurePolling()
    }

    @Synchronized
    fun forget(taskId: String) {
        watched -= taskId
        _tasks.update { it - taskId }
    }

    private fun ensurePolling() {
        if (pollJob?.isActive == true) return
        startService()
        pollJob = scope.launch {
            while (isActive && snapshotWatched().isNotEmpty()) {
                snapshotWatched().forEach { taskId -> pollOnce(taskId) }
                delay(POLL_INTERVAL_MS)
            }
            stopService()
        }
    }

    private suspend fun pollOnce(taskId: String) {
        val status = runCatching { repository.getTask(taskId) }.getOrNull() ?: return
        _tasks.update { it + (taskId to status) }
        if (status.isTerminal) {
            synchronized(this) { watched -= taskId }
            _finished.emit(Finished(taskId, status.state == TaskStatus.STATE_FAILED))
        }
    }

    @Synchronized
    private fun snapshotWatched(): List<String> = watched.toList()

    private fun startService() = runCatching {
        val intent = Intent(context, TaskPollerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    private fun stopService() = runCatching {
        context.stopService(Intent(context, TaskPollerService::class.java))
    }

    private companion object {
        const val POLL_INTERVAL_MS = 3_000L
    }
}
