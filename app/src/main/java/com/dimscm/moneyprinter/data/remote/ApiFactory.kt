package com.dimscm.moneyprinter.data.remote

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

/**
 * Builds (and caches) a Retrofit client for whatever server the user has configured.
 *
 * The base URL and API key live in settings and can change at any moment, so the client is
 * rebuilt whenever either of them differs from the one that produced the cached instance.
 */
object ApiFactory {

    val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    private var cacheKey: Pair<String, String>? = null
    private var cached: MoneyPrinterApi? = null

    /** Normalises `192.168.1.10:8080` / `http://host/` into a Retrofit-safe base URL. */
    fun normalizeBaseUrl(raw: String): String {
        var url = raw.trim()
        if (url.isEmpty()) return ""
        if (!url.startsWith("http://", ignoreCase = true) && !url.startsWith("https://", ignoreCase = true)) {
            url = "http://$url"
        }
        // The API interface already carries the `api/v1/...` path segments.
        url = url.removeSuffix("/").removeSuffix("/api/v1")
        return "$url/"
    }

    @Synchronized
    fun api(baseUrl: String, apiKey: String): MoneyPrinterApi {
        val normalized = normalizeBaseUrl(baseUrl)
        require(normalized.isNotEmpty()) { "Server address is empty" }
        val key = normalized to apiKey
        cached?.let { if (cacheKey == key) return it }

        val client = okHttpClient(apiKey)
        val retrofit = Retrofit.Builder()
            .baseUrl(normalized)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        val api = retrofit.create(MoneyPrinterApi::class.java)
        cacheKey = key
        cached = api
        return api
    }

    fun okHttpClient(apiKey: String): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        // Script generation on a cold LLM connection can take a while.
        .readTimeout(180, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .addInterceptor(apiKeyInterceptor(apiKey))
        .build()

    private fun apiKeyInterceptor(apiKey: String) = Interceptor { chain ->
        val request = if (apiKey.isBlank()) {
            chain.request()
        } else {
            chain.request().newBuilder().header("x-api-key", apiKey).build()
        }
        chain.proceed(request)
    }
}
