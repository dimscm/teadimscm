package com.dimscm.moneyprinter.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.dimscm.moneyprinter.data.llm.LlmProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "moneyprinter_settings")

/**
 * Single source of truth for user settings.
 *
 * Plain values live in DataStore; the two API keys live in [SecretStore] and are surfaced through
 * a state flow so the UI still reacts to them.
 */
class SettingsRepository(context: Context) {

    private val appContext = context.applicationContext
    private val store = appContext.dataStore
    private val secrets = SecretStore(appContext)

    private val serverApiKey = MutableStateFlow(secrets.get(SecretKeys.SERVER_API_KEY))
    private val llmApiKey = MutableStateFlow(secrets.get(SecretKeys.LLM_API_KEY))

    val settings: Flow<AppSettings> = combine(
        store.data,
        serverApiKey,
        llmApiKey,
    ) { prefs, serverKey, aiKey ->
        AppSettings(
            server = ServerSettings(
                baseUrl = prefs[Keys.serverUrl].orEmpty(),
                apiKey = serverKey,
            ),
            ai = AiSettings(
                mode = AiMode.fromId(prefs[Keys.aiMode]),
                provider = LlmProvider.fromId(prefs[Keys.aiProvider]),
                apiKey = aiKey,
                baseUrl = prefs[Keys.aiBaseUrl].orEmpty(),
                model = prefs[Keys.aiModel].orEmpty(),
            ),
            defaults = prefs.toVideoDefaults(),
        )
    }

    val serverSettings: Flow<ServerSettings> = settings.map { it.server }

    suspend fun setServer(baseUrl: String, apiKey: String) {
        store.edit { it[Keys.serverUrl] = baseUrl.trim() }
        secrets.put(SecretKeys.SERVER_API_KEY, apiKey.trim())
        serverApiKey.value = apiKey.trim()
    }

    suspend fun setAi(settings: AiSettings) {
        store.edit { prefs ->
            prefs[Keys.aiMode] = settings.mode.name
            prefs[Keys.aiProvider] = settings.provider.id
            prefs[Keys.aiBaseUrl] = settings.baseUrl.trim()
            prefs[Keys.aiModel] = settings.model.trim()
        }
        secrets.put(SecretKeys.LLM_API_KEY, settings.apiKey.trim())
        llmApiKey.value = settings.apiKey.trim()
    }

    suspend fun setDefaults(defaults: VideoDefaults) {
        store.edit { prefs ->
            prefs[Keys.aspect] = defaults.aspect
            prefs[Keys.concatMode] = defaults.concatMode
            prefs[Keys.transitionMode] = defaults.transitionMode
            prefs[Keys.clipDuration] = defaults.clipDuration
            prefs[Keys.clipSpeed] = defaults.clipSpeed
            prefs[Keys.videoCount] = defaults.videoCount
            prefs[Keys.videoSource] = defaults.videoSource
            prefs[Keys.matchMaterials] = defaults.matchMaterialsToScript
            prefs[Keys.language] = defaults.language
            prefs[Keys.paragraphNumber] = defaults.paragraphNumber
            prefs[Keys.voiceName] = defaults.voiceName
            prefs[Keys.voiceVolume] = defaults.voiceVolume
            prefs[Keys.voiceRate] = defaults.voiceRate
            prefs[Keys.bgmType] = defaults.bgmType
            prefs[Keys.bgmFile] = defaults.bgmFile
            prefs[Keys.bgmVolume] = defaults.bgmVolume
            prefs[Keys.subtitleEnabled] = defaults.subtitleEnabled
            prefs[Keys.subtitlePosition] = defaults.subtitlePosition
            prefs[Keys.customPosition] = defaults.customPosition
            prefs[Keys.fontName] = defaults.fontName
            prefs[Keys.fontSize] = defaults.fontSize
            prefs[Keys.textForeColor] = defaults.textForeColor
            prefs[Keys.strokeColor] = defaults.strokeColor
            prefs[Keys.strokeWidth] = defaults.strokeWidth
            prefs[Keys.textBackgroundEnabled] = defaults.textBackgroundEnabled
            prefs[Keys.roundedBackground] = defaults.roundedSubtitleBackground
            prefs[Keys.nThreads] = defaults.nThreads
        }
    }

    private fun Preferences.toVideoDefaults(): VideoDefaults {
        val fallback = VideoDefaults()
        return VideoDefaults(
            aspect = this[Keys.aspect] ?: fallback.aspect,
            concatMode = this[Keys.concatMode] ?: fallback.concatMode,
            transitionMode = this[Keys.transitionMode] ?: fallback.transitionMode,
            clipDuration = this[Keys.clipDuration] ?: fallback.clipDuration,
            clipSpeed = this[Keys.clipSpeed] ?: fallback.clipSpeed,
            videoCount = this[Keys.videoCount] ?: fallback.videoCount,
            videoSource = this[Keys.videoSource] ?: fallback.videoSource,
            matchMaterialsToScript = this[Keys.matchMaterials] ?: fallback.matchMaterialsToScript,
            language = this[Keys.language] ?: fallback.language,
            paragraphNumber = this[Keys.paragraphNumber] ?: fallback.paragraphNumber,
            voiceName = this[Keys.voiceName] ?: fallback.voiceName,
            voiceVolume = this[Keys.voiceVolume] ?: fallback.voiceVolume,
            voiceRate = this[Keys.voiceRate] ?: fallback.voiceRate,
            bgmType = this[Keys.bgmType] ?: fallback.bgmType,
            bgmFile = this[Keys.bgmFile] ?: fallback.bgmFile,
            bgmVolume = this[Keys.bgmVolume] ?: fallback.bgmVolume,
            subtitleEnabled = this[Keys.subtitleEnabled] ?: fallback.subtitleEnabled,
            subtitlePosition = this[Keys.subtitlePosition] ?: fallback.subtitlePosition,
            customPosition = this[Keys.customPosition] ?: fallback.customPosition,
            fontName = this[Keys.fontName] ?: fallback.fontName,
            fontSize = this[Keys.fontSize] ?: fallback.fontSize,
            textForeColor = this[Keys.textForeColor] ?: fallback.textForeColor,
            strokeColor = this[Keys.strokeColor] ?: fallback.strokeColor,
            strokeWidth = this[Keys.strokeWidth] ?: fallback.strokeWidth,
            textBackgroundEnabled = this[Keys.textBackgroundEnabled] ?: fallback.textBackgroundEnabled,
            roundedSubtitleBackground = this[Keys.roundedBackground] ?: fallback.roundedSubtitleBackground,
            nThreads = this[Keys.nThreads] ?: fallback.nThreads,
        )
    }

    private object Keys {
        val serverUrl = stringPreferencesKey("server_url")

        val aiMode = stringPreferencesKey("ai_mode")
        val aiProvider = stringPreferencesKey("ai_provider")
        val aiBaseUrl = stringPreferencesKey("ai_base_url")
        val aiModel = stringPreferencesKey("ai_model")

        val aspect = stringPreferencesKey("aspect")
        val concatMode = stringPreferencesKey("concat_mode")
        val transitionMode = stringPreferencesKey("transition_mode")
        val clipDuration = intPreferencesKey("clip_duration")
        val clipSpeed = doublePreferencesKey("clip_speed")
        val videoCount = intPreferencesKey("video_count")
        val videoSource = stringPreferencesKey("video_source")
        val matchMaterials = booleanPreferencesKey("match_materials")
        val language = stringPreferencesKey("language")
        val paragraphNumber = intPreferencesKey("paragraph_number")
        val voiceName = stringPreferencesKey("voice_name")
        val voiceVolume = doublePreferencesKey("voice_volume")
        val voiceRate = doublePreferencesKey("voice_rate")
        val bgmType = stringPreferencesKey("bgm_type")
        val bgmFile = stringPreferencesKey("bgm_file")
        val bgmVolume = doublePreferencesKey("bgm_volume")
        val subtitleEnabled = booleanPreferencesKey("subtitle_enabled")
        val subtitlePosition = stringPreferencesKey("subtitle_position")
        val customPosition = doublePreferencesKey("custom_position")
        val fontName = stringPreferencesKey("font_name")
        val fontSize = intPreferencesKey("font_size")
        val textForeColor = stringPreferencesKey("text_fore_color")
        val strokeColor = stringPreferencesKey("stroke_color")
        val strokeWidth = doublePreferencesKey("stroke_width")
        val textBackgroundEnabled = booleanPreferencesKey("text_background_enabled")
        val roundedBackground = booleanPreferencesKey("rounded_background")
        val nThreads = intPreferencesKey("n_threads")
    }
}
