package com.dimscm.moneyprinter.data.settings

import com.dimscm.moneyprinter.data.llm.LlmConfig
import com.dimscm.moneyprinter.data.llm.LlmProvider

/** Where script/keyword generation happens. */
enum class AiMode {
    /** Ask MoneyPrinterTurbo to use the key configured in its own config.toml. */
    SERVER,

    /** Call the provider straight from this phone with a key the user typed in. */
    ON_DEVICE,
    ;

    companion object {
        fun fromId(id: String?): AiMode = entries.firstOrNull { it.name == id } ?: SERVER
    }
}

data class ServerSettings(
    val baseUrl: String = "",
    val apiKey: String = "",
) {
    val isConfigured: Boolean get() = baseUrl.isNotBlank()
}

data class AiSettings(
    val mode: AiMode = AiMode.SERVER,
    val provider: LlmProvider = LlmProvider.OPENAI,
    val apiKey: String = "",
    val baseUrl: String = "",
    val model: String = "",
) {
    fun toLlmConfig(): LlmConfig = LlmConfig(
        provider = provider,
        apiKey = apiKey,
        baseUrl = baseUrl,
        model = model,
    )
}

/** Values that pre-fill the "new video" form. Mirrors `VideoParams` on the server. */
data class VideoDefaults(
    val aspect: String = "9:16",
    val concatMode: String = "random",
    val transitionMode: String = "",
    val clipDuration: Int = 5,
    val clipSpeed: Double = 1.0,
    val videoCount: Int = 1,
    val videoSource: String = "pexels",
    val matchMaterialsToScript: Boolean = false,
    val language: String = "",
    val paragraphNumber: Int = 1,
    val voiceName: String = "id-ID-ArdiNeural-Male",
    val voiceVolume: Double = 1.0,
    val voiceRate: Double = 1.0,
    val bgmType: String = "random",
    val bgmFile: String = "",
    val bgmVolume: Double = 0.2,
    val subtitleEnabled: Boolean = true,
    val subtitlePosition: String = "bottom",
    val customPosition: Double = 70.0,
    val fontName: String = "STHeitiMedium.ttc",
    val fontSize: Int = 60,
    val textForeColor: String = "#FFFFFF",
    val strokeColor: String = "#000000",
    val strokeWidth: Double = 1.5,
    val textBackgroundEnabled: Boolean = false,
    val roundedSubtitleBackground: Boolean = false,
    val nThreads: Int = 2,
)

data class AppSettings(
    val server: ServerSettings = ServerSettings(),
    val ai: AiSettings = AiSettings(),
    val defaults: VideoDefaults = VideoDefaults(),
)

/** Option lists shared by the form and the settings screen. */
object Options {
    val aspects = listOf("9:16", "16:9", "1:1")
    val concatModes = listOf("random", "sequential")
    val transitions = listOf("", "Shuffle", "FadeIn", "FadeOut", "SlideIn", "SlideOut", "ZoomIn", "ZoomOut")
    val videoSources = listOf("pexels", "pixabay", "coverr", "local")
    val subtitlePositions = listOf("top", "center", "bottom", "custom")
    val bgmTypes = listOf("random", "", "custom")

    /** Language hints for the script writer; empty means "follow the subject". */
    val languages = listOf("", "Indonesian", "English", "Malay", "Javanese", "Spanish", "Portuguese", "Chinese", "Japanese", "Arabic")

    /**
     * Edge-TTS voices, in the `locale-VoiceName-Gender` shape MoneyPrinterTurbo expects.
     * The field stays editable so any other edge-tts voice can be typed in.
     */
    val voices = listOf(
        "id-ID-ArdiNeural-Male",
        "id-ID-GadisNeural-Female",
        "ms-MY-OsmanNeural-Male",
        "ms-MY-YasminNeural-Female",
        "en-US-GuyNeural-Male",
        "en-US-JennyNeural-Female",
        "en-US-AriaNeural-Female",
        "en-GB-RyanNeural-Male",
        "en-GB-SoniaNeural-Female",
        "zh-CN-YunxiNeural-Male",
        "zh-CN-XiaoxiaoNeural-Female",
        "ja-JP-NanamiNeural-Female",
        "es-ES-AlvaroNeural-Male",
        "ar-SA-HamedNeural-Male",
    )

    /** Fonts shipped in MoneyPrinterTurbo's `resource/fonts` directory. */
    val fonts = listOf(
        "STHeitiMedium.ttc",
        "MicrosoftYaHeiBold.ttc",
        "MicrosoftYaHeiNormal.ttc",
        "UTM Kabel KT.ttf",
        "Charm-Regular.ttf",
        "Charm-Bold.ttf",
    )
}
