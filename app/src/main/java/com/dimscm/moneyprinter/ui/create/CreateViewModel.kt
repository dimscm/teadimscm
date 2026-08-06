package com.dimscm.moneyprinter.ui.create

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.remote.TaskVideoRequest
import com.dimscm.moneyprinter.data.settings.AiMode
import com.dimscm.moneyprinter.data.settings.VideoDefaults
import com.dimscm.moneyprinter.di.ServiceLocator
import com.dimscm.moneyprinter.ui.userMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive

data class CreateUiState(
    val subject: String = "",
    val script: String = "",
    val terms: String = "",
    val scriptPrompt: String = "",
    val params: VideoDefaults = VideoDefaults(),
    val aiMode: AiMode = AiMode.SERVER,
    val serverConfigured: Boolean = true,
    val bgmFiles: List<String> = emptyList(),
    val generatingScript: Boolean = false,
    val generatingTerms: Boolean = false,
    val submitting: Boolean = false,
    val message: String? = null,
    val createdTaskId: String? = null,
) {
    val busy: Boolean get() = generatingScript || generatingTerms || submitting
}

class CreateViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ServiceLocator.repository
    private val settingsRepository = ServiceLocator.settingsRepository
    private val watcher = ServiceLocator.taskWatcher

    private val _state = MutableStateFlow(CreateUiState())
    val state: StateFlow<CreateUiState> = _state.asStateFlow()

    /** Defaults pre-fill the form once; after that the user's edits win. */
    private var defaultsApplied = false

    init {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                _state.update { current ->
                    current.copy(
                        params = if (defaultsApplied) current.params else settings.defaults,
                        aiMode = settings.ai.mode,
                        serverConfigured = settings.server.isConfigured,
                    )
                }
                defaultsApplied = true
            }
        }
    }

    fun onSubjectChange(value: String) = _state.update { it.copy(subject = value) }
    fun onScriptChange(value: String) = _state.update { it.copy(script = value) }
    fun onTermsChange(value: String) = _state.update { it.copy(terms = value) }
    fun onScriptPromptChange(value: String) = _state.update { it.copy(scriptPrompt = value) }
    fun onParamsChange(params: VideoDefaults) = _state.update { it.copy(params = params) }

    fun consumeMessage() = _state.update { it.copy(message = null) }
    fun consumeCreatedTask() = _state.update { it.copy(createdTaskId = null) }

    fun reset() {
        viewModelScope.launch {
            val settings = settingsRepository.settings.first()
            _state.value = CreateUiState(
                params = settings.defaults,
                aiMode = settings.ai.mode,
                serverConfigured = settings.server.isConfigured,
            )
        }
    }

    fun refreshBgmFiles() {
        viewModelScope.launch {
            val files = runCatching { repository.listMusics() }.getOrNull().orEmpty()
            _state.update { it.copy(bgmFiles = files.map { file -> file.file }.filter { name -> name.isNotBlank() }) }
        }
    }

    fun generateScript() {
        val current = _state.value
        if (current.subject.isBlank()) {
            showMessage(R.string.msg_subject_required)
            return
        }
        _state.update { it.copy(generatingScript = true) }
        viewModelScope.launch {
            runCatching {
                repository.generateScript(
                    subject = current.subject,
                    language = current.params.language,
                    paragraphs = current.params.paragraphNumber,
                    extraInstruction = current.scriptPrompt,
                )
            }.onSuccess { script ->
                _state.update { it.copy(script = script, generatingScript = false) }
            }.onFailure { error ->
                _state.update { it.copy(generatingScript = false, message = error.userMessage(context())) }
            }
        }
    }

    fun generateTerms() {
        val current = _state.value
        if (current.subject.isBlank()) {
            showMessage(R.string.msg_subject_required)
            return
        }
        if (current.script.isBlank()) {
            showMessage(R.string.msg_script_required)
            return
        }
        _state.update { it.copy(generatingTerms = true) }
        viewModelScope.launch {
            runCatching {
                repository.generateTerms(current.subject, current.script)
            }.onSuccess { terms ->
                _state.update { it.copy(terms = terms.joinToString(", "), generatingTerms = false) }
            }.onFailure { error ->
                _state.update { it.copy(generatingTerms = false, message = error.userMessage(context())) }
            }
        }
    }

    fun submit() {
        val current = _state.value
        if (current.subject.isBlank()) {
            showMessage(R.string.msg_subject_required)
            return
        }
        _state.update { it.copy(submitting = true) }
        viewModelScope.launch {
            runCatching { repository.createVideo(current.toRequest()) }
                .onSuccess { taskId ->
                    watcher.watch(taskId)
                    _state.update {
                        it.copy(
                            submitting = false,
                            createdTaskId = taskId,
                            message = context().getString(R.string.msg_task_created),
                        )
                    }
                }
                .onFailure { error ->
                    _state.update { it.copy(submitting = false, message = error.userMessage(context())) }
                }
        }
    }

    private fun showMessage(resId: Int) = _state.update { it.copy(message = context().getString(resId)) }

    private fun context() = getApplication<Application>()

    private fun CreateUiState.toRequest(): TaskVideoRequest {
        val p = params
        return TaskVideoRequest(
            videoSubject = subject.trim(),
            videoScript = script.trim(),
            videoTerms = terms.trim().ifBlank { null },
            videoAspect = p.aspect,
            videoConcatMode = p.concatMode,
            videoTransitionMode = p.transitionMode.ifBlank { null },
            videoClipDuration = p.clipDuration,
            videoClipSpeed = p.clipSpeed,
            matchMaterialsToScript = p.matchMaterialsToScript,
            videoCount = p.videoCount,
            videoSource = p.videoSource,
            videoLanguage = p.language,
            voiceName = p.voiceName,
            voiceVolume = p.voiceVolume,
            voiceRate = p.voiceRate,
            bgmType = p.bgmType,
            bgmFile = p.bgmFile,
            bgmVolume = p.bgmVolume,
            subtitleEnabled = p.subtitleEnabled,
            subtitlePosition = p.subtitlePosition,
            customPosition = p.customPosition,
            fontName = p.fontName,
            textForeColor = p.textForeColor,
            textBackgroundColor = if (p.textBackgroundEnabled) {
                JsonPrimitive("#000000")
            } else {
                JsonPrimitive(false)
            },
            roundedSubtitleBackground = p.roundedSubtitleBackground,
            fontSize = p.fontSize,
            strokeColor = p.strokeColor,
            strokeWidth = p.strokeWidth,
            nThreads = p.nThreads,
            paragraphNumber = p.paragraphNumber,
            videoScriptPrompt = scriptPrompt.trim(),
        )
    }
}
