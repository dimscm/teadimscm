package com.dimscm.moneyprinter.data.llm

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class LlmConfig(
    val provider: LlmProvider,
    val apiKey: String,
    val baseUrl: String,
    val model: String,
) {
    val effectiveBaseUrl: String
        get() = baseUrl.ifBlank { provider.defaultBaseUrl }.trim().removeSuffix("/")

    val effectiveModel: String
        get() = model.ifBlank { provider.defaultModel }.trim()

    /** True when the config has everything needed to make a call. */
    val isUsable: Boolean
        get() = effectiveBaseUrl.isNotBlank() &&
            effectiveModel.isNotBlank() &&
            (!provider.requiresKey || apiKey.isNotBlank())
}

class LlmException(message: String) : Exception(message)

/**
 * Calls the user's own AI provider straight from the phone.
 *
 * The resulting script and keywords are then handed to MoneyPrinterTurbo, so the server never
 * needs an LLM key of its own.
 */
class LlmClient(
    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true },
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .build(),
) {

    suspend fun generateScript(
        config: LlmConfig,
        subject: String,
        language: String,
        paragraphs: Int,
        extraInstruction: String,
    ): String {
        val raw = chat(
            config = config,
            system = Prompts.SCRIPT_SYSTEM.trimIndent(),
            user = Prompts.scriptUser(subject, language, paragraphs, extraInstruction),
        )
        return cleanScript(raw)
    }

    suspend fun generateTerms(
        config: LlmConfig,
        subject: String,
        script: String,
        amount: Int,
    ): List<String> {
        val raw = chat(
            config = config,
            system = Prompts.TERMS_SYSTEM.trimIndent(),
            user = Prompts.termsUser(subject, script, amount),
        )
        return parseTerms(raw, amount)
    }

    suspend fun chat(config: LlmConfig, system: String, user: String): String =
        withContext(Dispatchers.IO) {
            when (config.provider.dialect) {
                LlmDialect.GEMINI -> callGemini(config, system, user)
                LlmDialect.OPENAI -> callOpenAiCompatible(config, system, user)
            }
        }

    private fun callOpenAiCompatible(config: LlmConfig, system: String, user: String): String {
        val payload = buildJsonObject {
            put("model", config.effectiveModel)
            put("temperature", 0.9)
            // Gateways in front of several models often stream by default.
            put("stream", false)
            putJsonArray("messages") {
                addJsonObject {
                    put("role", "system")
                    put("content", system)
                }
                addJsonObject {
                    put("role", "user")
                    put("content", user)
                }
            }
        }

        val builder = Request.Builder()
            .url("${config.effectiveBaseUrl}/chat/completions")
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
        if (config.apiKey.isNotBlank()) {
            builder.header("Authorization", "Bearer ${config.apiKey}")
        }

        val body = execute(builder.build())
        parseEventStream(body)?.let { return it }

        val root = json.parseToJsonElement(body).jsonObject
        root["error"]?.let { throw LlmException(errorMessage(it)) }
        val message = root["choices"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("message")?.jsonObject
            ?: throw LlmException("The provider returned no choices")
        return message["content"]?.jsonPrimitive?.content.orEmpty()
    }

    /**
     * Reassembles a Server-Sent Events reply into the full message.
     *
     * Some OpenAI-compatible gateways stream even when the request did not ask them to, answering
     * with `data: {...}` lines instead of one JSON object. Returns null for an ordinary body.
     */
    private fun parseEventStream(body: String): String? {
        if (!body.trimStart().startsWith("data:")) return null

        val text = StringBuilder()
        body.lineSequence().forEach { line ->
            val payload = line.trim().removePrefix("data:").trim()
            if (payload.isEmpty() || payload == "[DONE]") return@forEach
            runCatching {
                val choice = json.parseToJsonElement(payload)
                    .jsonObject["choices"]?.jsonArray?.firstOrNull()?.jsonObject
                    ?: return@runCatching
                // Streaming chunks carry "delta"; a final non-streamed event carries "message".
                val piece = choice["delta"]?.jsonObject?.get("content")?.jsonPrimitive?.contentOrNull
                    ?: choice["message"]?.jsonObject?.get("content")?.jsonPrimitive?.contentOrNull
                text.append(piece.orEmpty())
            }
        }

        return text.toString().ifBlank {
            throw LlmException("The provider streamed a reply with no content")
        }
    }

    private fun callGemini(config: LlmConfig, system: String, user: String): String {
        val payload = buildJsonObject {
            putJsonObject("systemInstruction") {
                putJsonArray("parts") {
                    addJsonObject { put("text", system) }
                }
            }
            putJsonArray("contents") {
                addJsonObject {
                    put("role", "user")
                    putJsonArray("parts") {
                        addJsonObject { put("text", user) }
                    }
                }
            }
        }

        val url = "${config.effectiveBaseUrl}/v1beta/models/${config.effectiveModel}:generateContent"
        val request = Request.Builder()
            .url(url)
            .header("x-goog-api-key", config.apiKey)
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val body = execute(request)
        val root = json.parseToJsonElement(body).jsonObject
        root["error"]?.let { throw LlmException(errorMessage(it)) }
        val parts = root["candidates"]?.jsonArray?.firstOrNull()
            ?.jsonObject?.get("content")?.jsonObject?.get("parts")?.jsonArray
            ?: throw LlmException("Gemini returned no candidates")
        return parts.joinToString("") { it.jsonObject["text"]?.jsonPrimitive?.content.orEmpty() }
    }

    private fun execute(request: Request): String {
        client.newCall(request).execute().use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw LlmException("HTTP ${response.code} — ${body.take(300)}")
            }
            return body
        }
    }

    private fun errorMessage(element: JsonElement): String {
        val obj = element as? JsonObject ?: return element.toString()
        return obj["message"]?.jsonPrimitive?.content ?: obj.toString()
    }

    private fun cleanScript(raw: String): String = raw
        .trim()
        .removeSurrounding("\"")
        .lines()
        .filterNot { it.trim().startsWith("```") }
        .joinToString("\n")
        .replace(Regex("^#+\\s*", RegexOption.MULTILINE), "")
        .replace(Regex("\\*+"), "")
        .trim()

    private fun parseTerms(raw: String, amount: Int): List<String> {
        val stripped = raw.trim()
            .removePrefix("```json").removePrefix("```")
            .removeSuffix("```")
            .trim()

        val fromJson = runCatching {
            val start = stripped.indexOf('[')
            val end = stripped.lastIndexOf(']')
            if (start < 0 || end <= start) return@runCatching null
            (json.parseToJsonElement(stripped.substring(start, end + 1)) as? JsonArray)
                ?.mapNotNull { (it as? JsonPrimitive)?.content }
        }.getOrNull()

        val terms = fromJson ?: stripped
            .split(',', '\n')
            .map { it.trim().trim('-', '"', '\'', '.', '*').trim() }

        return terms
            .filter { it.isNotBlank() }
            .distinct()
            .take(amount.coerceAtLeast(1))
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
