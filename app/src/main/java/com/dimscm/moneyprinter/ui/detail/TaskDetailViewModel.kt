package com.dimscm.moneyprinter.ui.detail

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dimscm.moneyprinter.data.remote.TaskStatus
import com.dimscm.moneyprinter.di.ServiceLocator
import com.dimscm.moneyprinter.ui.userMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TaskDetailUiState(
    val taskId: String = "",
    val task: TaskStatus? = null,
    val videoUrls: List<String> = emptyList(),
    val serverApiKey: String = "",
    val loading: Boolean = false,
    val message: String? = null,
    val deleted: Boolean = false,
)

class TaskDetailViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ServiceLocator.repository
    private val watcher = ServiceLocator.taskWatcher

    private val _state = MutableStateFlow(TaskDetailUiState())
    val state: StateFlow<TaskDetailUiState> = _state.asStateFlow()

    private var started = false

    fun start(taskId: String) {
        if (started) return
        started = true
        _state.update { it.copy(taskId = taskId) }
        watcher.watch(taskId)

        viewModelScope.launch {
            _state.update { it.copy(serverApiKey = repository.settings().server.apiKey) }
        }
        viewModelScope.launch {
            watcher.tasks.collect { byId ->
                val task = byId[taskId] ?: return@collect
                val files = task.combinedVideos.takeIf { it.isNotEmpty() } ?: task.videos
                val urls = files.map { repository.resolveMediaUrl(it) }
                _state.update { it.copy(task = task, videoUrls = urls) }
            }
        }
        refresh()
    }

    fun refresh() {
        val taskId = _state.value.taskId
        if (taskId.isBlank()) return
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            runCatching { repository.getTask(taskId) }
                .onSuccess { task ->
                    watcher.merge(listOf(task))
                    _state.update { it.copy(loading = false) }
                }
                .onFailure { error ->
                    _state.update { it.copy(loading = false, message = error.userMessage(getApplication())) }
                }
        }
    }

    fun delete() {
        val taskId = _state.value.taskId
        viewModelScope.launch {
            runCatching { repository.deleteTask(taskId) }
                .onSuccess {
                    watcher.forget(taskId)
                    _state.update { it.copy(deleted = true) }
                }
                .onFailure { error ->
                    _state.update { it.copy(message = error.userMessage(getApplication())) }
                }
        }
    }

    fun showMessage(text: String) = _state.update { it.copy(message = text) }

    fun consumeMessage() = _state.update { it.copy(message = null) }
}
