package com.dimscm.moneyprinter.data

import com.dimscm.moneyprinter.data.llm.LlmClient
import com.dimscm.moneyprinter.data.llm.LlmException
import com.dimscm.moneyprinter.data.remote.ApiFactory
import com.dimscm.moneyprinter.data.remote.BgmFile
import com.dimscm.moneyprinter.data.remote.MoneyPrinterApi
import com.dimscm.moneyprinter.data.remote.TaskStatus
import com.dimscm.moneyprinter.data.remote.TaskVideoRequest
import com.dimscm.moneyprinter.data.remote.VideoScriptRequest
import com.dimscm.moneyprinter.data.remote.VideoTermsRequest
import com.dimscm.moneyprinter.data.settings.AiMode
import com.dimscm.moneyprinter.data.settings.AppSettings
import com.dimscm.moneyprinter.data.settings.SettingsRepository
import kotlinx.coroutines.flow.first
import java.io.IOException

class ServerNotConfiguredException : IOException("Server address is not set")

/**
 * Everything the UI needs from the outside world: the MoneyPrinterTurbo server and, when the
 * user brings their own key, the AI provider.
 */
class MoneyPrinterRepository(
    private val settingsRepository: SettingsRepository,
    private val llmClient: LlmClient,
) {

    suspend fun settings(): AppSettings = settingsRepository.settings.first()

    private suspend fun api(): MoneyPrinterApi {
        val server = settings().server
        if (!server.isConfigured) throw ServerNotConfiguredException()
        return ApiFactory.api(server.baseUrl, server.apiKey)
    }

    suspend fun createVideo(request: TaskVideoRequest): String {
        val envelope = api().createVideo(request)
        return envelope.data?.taskId?.takeIf { it.isNotBlank() }
            ?: throw IOException(envelope.message ?: "The server did not return a task id")
    }

    suspend fun listTasks(page: Int = 1, pageSize: Int = 30): List<TaskStatus> =
        api().listTasks(page, pageSize).data?.tasks.orEmpty()

    suspend fun getTask(taskId: String): TaskStatus =
        api().getTask(taskId).data ?: throw IOException("Task $taskId was not found")

    suspend fun deleteTask(taskId: String) {
        api().deleteTask(taskId)
    }

    suspend fun listMusics(): List<BgmFile> = api().listMusics().data?.files.orEmpty()

    /** A cheap round trip used by the "test connection" button. */
    suspend fun ping() {
        api().listTasks(page = 1, pageSize = 1)
    }

    suspend fun generateScript(
        subject: String,
        language: String,
        paragraphs: Int,
        extraInstruction: String,
    ): String {
        val settings = settings()
        return when (settings.ai.mode) {
            AiMode.ON_DEVICE -> {
                val config = settings.ai.toLlmConfig()
                if (!config.isUsable) throw LlmException("Fill in the AI provider, model and API key first")
                llmClient.generateScript(config, subject, language, paragraphs, extraInstruction)
            }

            AiMode.SERVER -> {
                val envelope = api().generateScript(
                    VideoScriptRequest(
                        videoSubject = subject,
                        videoLanguage = language,
                        paragraphNumber = paragraphs,
                        videoScriptPrompt = extraInstruction,
                    ),
                )
                envelope.data?.videoScript?.takeIf { it.isNotBlank() }
                    ?: throw IOException(envelope.message ?: "The server returned an empty script")
            }
        }
    }

    suspend fun generateTerms(subject: String, script: String, amount: Int = 5): List<String> {
        val settings = settings()
        return when (settings.ai.mode) {
            AiMode.ON_DEVICE -> {
                val config = settings.ai.toLlmConfig()
                if (!config.isUsable) throw LlmException("Fill in the AI provider, model and API key first")
                llmClient.generateTerms(config, subject, script, amount)
            }

            AiMode.SERVER -> api()
                .generateTerms(VideoTermsRequest(subject, script, amount))
                .data?.videoTerms
                .orEmpty()
        }
    }

    /** Sends a one-word prompt to the configured provider so the user can verify their key. */
    suspend fun testAiKey(): String {
        val ai = settings().ai
        val config = ai.toLlmConfig()
        if (!config.isUsable) throw LlmException("Fill in the AI provider, model and API key first")
        return llmClient.chat(
            config = config,
            system = "You are a connection test. Answer with a single short word.",
            user = "Say OK",
        ).trim().take(60)
    }

    /**
     * Turns whatever the server put in `videos` into something a player can open.
     * The server returns an absolute URL when `endpoint` is configured and a `/tasks/...` path
     * otherwise, so both shapes have to work.
     */
    suspend fun resolveMediaUrl(pathOrUrl: String): String {
        if (pathOrUrl.startsWith("http://", true) || pathOrUrl.startsWith("https://", true)) {
            return pathOrUrl
        }
        val base = ApiFactory.normalizeBaseUrl(settings().server.baseUrl)
        if (base.isEmpty()) return pathOrUrl
        return base + pathOrUrl.removePrefix("/")
    }
}
