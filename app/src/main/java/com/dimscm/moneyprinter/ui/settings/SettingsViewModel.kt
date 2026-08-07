package com.dimscm.moneyprinter.ui.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.settings.AiSettings
import com.dimscm.moneyprinter.data.settings.VideoDefaults
import com.dimscm.moneyprinter.di.ServiceLocator
import com.dimscm.moneyprinter.ui.userMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val serverUrl: String = "",
    val serverApiKey: String = "",
    val ai: AiSettings = AiSettings(),
    val defaults: VideoDefaults = VideoDefaults(),
    val testingServer: Boolean = false,
    val testingAi: Boolean = false,
    val loaded: Boolean = false,
    val message: String? = null,
)

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ServiceLocator.repository
    private val settingsRepository = ServiceLocator.settingsRepository

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = settingsRepository.settings.first()
            _state.update {
                it.copy(
                    serverUrl = settings.server.baseUrl,
                    serverApiKey = settings.server.apiKey,
                    ai = settings.ai,
                    defaults = settings.defaults,
                    loaded = true,
                )
            }
        }
    }

    fun onServerUrlChange(value: String) = _state.update { it.copy(serverUrl = value) }
    fun onServerApiKeyChange(value: String) = _state.update { it.copy(serverApiKey = value) }
    fun onAiChange(ai: AiSettings) = _state.update { it.copy(ai = ai) }
    fun onDefaultsChange(defaults: VideoDefaults) = _state.update { it.copy(defaults = defaults) }
    fun consumeMessage() = _state.update { it.copy(message = null) }

    fun saveServer() {
        val current = _state.value
        viewModelScope.launch {
            settingsRepository.setServer(current.serverUrl, current.serverApiKey)
            showMessage(R.string.msg_saved)
        }
    }

    fun saveAi() {
        val current = _state.value
        viewModelScope.launch {
            settingsRepository.setAi(current.ai)
            showMessage(R.string.msg_saved)
        }
    }

    fun saveDefaults() {
        val current = _state.value
        viewModelScope.launch {
            settingsRepository.setDefaults(current.defaults)
            showMessage(R.string.msg_saved)
        }
    }

    /** Saves first, then pings, so the button always tests what the user just typed. */
    fun testServer() {
        val current = _state.value
        _state.update { it.copy(testingServer = true) }
        viewModelScope.launch {
            settingsRepository.setServer(current.serverUrl, current.serverApiKey)
            runCatching { repository.ping() }
                .onSuccess {
                    _state.update {
                        it.copy(testingServer = false, message = context().getString(R.string.msg_test_ok))
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            testingServer = false,
                            message = context().getString(R.string.msg_test_failed, error.userMessage(context())),
                        )
                    }
                }
        }
    }

    fun testAi() {
        val current = _state.value
        _state.update { it.copy(testingAi = true) }
        viewModelScope.launch {
            settingsRepository.setAi(current.ai)
            runCatching { repository.testAiKey() }
                .onSuccess { reply ->
                    _state.update {
                        it.copy(
                            testingAi = false,
                            message = context().getString(R.string.msg_ai_test_ok, reply),
                        )
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            testingAi = false,
                            message = context().getString(R.string.msg_test_failed, error.userMessage(context())),
                        )
                    }
                }
        }
    }

    private fun showMessage(resId: Int) = _state.update { it.copy(message = context().getString(resId)) }

    private fun context() = getApplication<Application>()
}
