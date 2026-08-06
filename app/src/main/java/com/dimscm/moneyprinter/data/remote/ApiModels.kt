package com.dimscm.moneyprinter.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/**
 * Wire models for the MoneyPrinterTurbo REST API (`/api/v1`).
 *
 * Every endpoint answers with the same envelope: `{ "status": 200, "message": "...", "data": ... }`.
 */

@Serializable
data class TaskVideoRequest(
    @SerialName("video_subject") val videoSubject: String,
    @SerialName("video_script") val videoScript: String = "",
    @SerialName("video_terms") val videoTerms: String? = null,
    @SerialName("video_aspect") val videoAspect: String = "9:16",
    @SerialName("video_concat_mode") val videoConcatMode: String = "random",
    @SerialName("video_transition_mode") val videoTransitionMode: String? = null,
    @SerialName("video_clip_duration") val videoClipDuration: Int = 5,
    @SerialName("video_clip_speed") val videoClipSpeed: Double = 1.0,
    @SerialName("match_materials_to_script") val matchMaterialsToScript: Boolean = false,
    @SerialName("video_count") val videoCount: Int = 1,
    @SerialName("video_source") val videoSource: String = "pexels",
    @SerialName("video_language") val videoLanguage: String = "",
    @SerialName("voice_name") val voiceName: String = "",
    @SerialName("voice_volume") val voiceVolume: Double = 1.0,
    @SerialName("voice_rate") val voiceRate: Double = 1.0,
    @SerialName("bgm_type") val bgmType: String = "random",
    @SerialName("bgm_file") val bgmFile: String = "",
    @SerialName("bgm_volume") val bgmVolume: Double = 0.2,
    @SerialName("subtitle_enabled") val subtitleEnabled: Boolean = true,
    @SerialName("subtitle_position") val subtitlePosition: String = "bottom",
    @SerialName("custom_position") val customPosition: Double = 70.0,
    @SerialName("font_name") val fontName: String = "STHeitiMedium.ttc",
    @SerialName("text_fore_color") val textForeColor: String = "#FFFFFF",
    @SerialName("text_background_color") val textBackgroundColor: JsonElement = JsonPrimitive(false),
    @SerialName("rounded_subtitle_background") val roundedSubtitleBackground: Boolean = false,
    @SerialName("font_size") val fontSize: Int = 60,
    @SerialName("stroke_color") val strokeColor: String = "#000000",
    @SerialName("stroke_width") val strokeWidth: Double = 1.5,
    @SerialName("n_threads") val nThreads: Int = 2,
    @SerialName("paragraph_number") val paragraphNumber: Int = 1,
    @SerialName("video_script_prompt") val videoScriptPrompt: String = "",
)

@Serializable
data class TaskIdData(
    @SerialName("task_id") val taskId: String = "",
)

@Serializable
data class TaskCreateEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: TaskIdData? = null,
)

@Serializable
data class TaskStatus(
    @SerialName("task_id") val taskId: String = "",
    val state: Int = STATE_UNKNOWN,
    val progress: Int = 0,
    val videos: List<String> = emptyList(),
    @SerialName("combined_videos") val combinedVideos: List<String> = emptyList(),
    @SerialName("failed_stage") val failedStage: String? = null,
    val error: String? = null,
) {
    val isTerminal: Boolean get() = state == STATE_COMPLETE || state == STATE_FAILED

    companion object {
        const val STATE_FAILED = -1
        const val STATE_COMPLETE = 1
        const val STATE_PROCESSING = 4
        const val STATE_UNKNOWN = 0
    }
}

@Serializable
data class TaskStatusEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: TaskStatus? = null,
)

@Serializable
data class TaskListData(
    val tasks: List<TaskStatus> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    @SerialName("page_size") val pageSize: Int = 10,
)

@Serializable
data class TaskListEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: TaskListData? = null,
)

@Serializable
data class SimpleEnvelope(
    val status: Int = 200,
    val message: String? = null,
)

@Serializable
data class BgmFile(
    val name: String = "",
    val size: Long = 0,
    val file: String = "",
)

@Serializable
data class BgmListData(
    val files: List<BgmFile> = emptyList(),
)

@Serializable
data class BgmListEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: BgmListData? = null,
)

@Serializable
data class VideoScriptRequest(
    @SerialName("video_subject") val videoSubject: String,
    @SerialName("video_language") val videoLanguage: String = "",
    @SerialName("paragraph_number") val paragraphNumber: Int = 1,
    @SerialName("video_script_prompt") val videoScriptPrompt: String = "",
)

@Serializable
data class VideoScriptData(
    @SerialName("video_script") val videoScript: String = "",
)

@Serializable
data class VideoScriptEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: VideoScriptData? = null,
)

@Serializable
data class VideoTermsRequest(
    @SerialName("video_subject") val videoSubject: String,
    @SerialName("video_script") val videoScript: String,
    val amount: Int = 5,
)

@Serializable
data class VideoTermsData(
    @SerialName("video_terms") val videoTerms: List<String> = emptyList(),
)

@Serializable
data class VideoTermsEnvelope(
    val status: Int = 200,
    val message: String? = null,
    val data: VideoTermsData? = null,
)
