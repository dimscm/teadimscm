package com.dimscm.moneyprinter.ui.tasks

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

data class TasksUiState(
    val tasks: List<TaskStatus> = emptyList(),
    val loading: Boolean = false,
    val serverConfigured: Boolean = true,
    val message: String? = null,
)

class TasksViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ServiceLocator.repository
    private val settingsRepository = ServiceLocator.settingsRepository
    private val watcher = ServiceLocator.taskWatcher

    private val _state = MutableStateFlow(TasksUiState())
    val state: StateFlow<TasksUiState> = _state.asStateFlow()

    /** Order as the server last reported it; the watcher's map on its own is unordered. */
    private var order: List<String> = emptyList()

    init {
        viewModelScope.launch {
            watcher.tasks.collect { byId ->
                val ordered = order.mapNotNull { byId[it] }
                val extras = byId.values.filter { it.taskId !in order }
                _state.update { it.copy(tasks = extras + ordered) }
            }
        }
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _state.update { it.copy(serverConfigured = settings.server.isConfigured) }
            }
        }
        refresh()
    }

    fun refresh() {
        if (_state.value.loading) return
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            runCatching { repository.listTasks() }
                .onSuccess { tasks ->
                    order = tasks.map { it.taskId }
                    watcher.merge(tasks)
                    _state.update { it.copy(loading = false) }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(loading = false, message = error.userMessage(getApplication()))
                    }
                }
        }
    }

    fun delete(taskId: String) {
        viewModelScope.launch {
            runCatching { repository.deleteTask(taskId) }
                .onSuccess {
                    order = order - taskId
                    watcher.forget(taskId)
                }
                .onFailure { error ->
                    _state.update { it.copy(message = error.userMessage(getApplication())) }
                }
        }
    }

    fun consumeMessage() = _state.update { it.copy(message = null) }
}
