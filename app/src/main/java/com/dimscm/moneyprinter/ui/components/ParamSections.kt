package com.dimscm.moneyprinter.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.settings.Options
import com.dimscm.moneyprinter.data.settings.VideoDefaults

/**
 * The render parameters, shared by the "new video" form and the "defaults" tab in settings so
 * both always offer exactly the same knobs.
 */

val colorPresets = listOf("#FFFFFF", "#000000", "#FFF200", "#FF3B30", "#34C759", "#0A84FF", "#FF9500")

@Composable
fun VideoParamsSection(params: VideoDefaults, onChange: (VideoDefaults) -> Unit) {
    SectionCard(title = stringResource(R.string.section_video)) {
        DropdownField(
            label = stringResource(R.string.label_aspect),
            options = Options.aspects,
            selected = params.aspect,
            onSelect = { onChange(params.copy(aspect = it)) },
            optionLabel = { it },
        )
        DropdownField(
            label = stringResource(R.string.label_video_source),
            options = Options.videoSources,
            selected = params.videoSource,
            onSelect = { onChange(params.copy(videoSource = it)) },
            optionLabel = { it },
        )
        DropdownField(
            label = stringResource(R.string.label_concat_mode),
            options = Options.concatModes,
            selected = params.concatMode,
            onSelect = { onChange(params.copy(concatMode = it)) },
            optionLabel = { concatLabel(it) },
        )
        DropdownField(
            label = stringResource(R.string.label_transition),
            options = Options.transitions,
            selected = params.transitionMode,
            onSelect = { onChange(params.copy(transitionMode = it)) },
            optionLabel = { transitionLabel(it) },
        )
        IntSliderField(
            label = stringResource(R.string.label_clip_duration),
            value = params.clipDuration,
            range = 1..15,
            onValueChange = { onChange(params.copy(clipDuration = it)) },
        )
        SliderField(
            label = stringResource(R.string.label_clip_speed),
            value = params.clipSpeed,
            range = 0.5f..2f,
            onValueChange = { onChange(params.copy(clipSpeed = it)) },
        )
        IntSliderField(
            label = stringResource(R.string.label_video_count),
            value = params.videoCount,
            range = 1..5,
            onValueChange = { onChange(params.copy(videoCount = it)) },
        )
        SwitchRow(
            label = stringResource(R.string.label_match_materials),
            checked = params.matchMaterialsToScript,
            onCheckedChange = { onChange(params.copy(matchMaterialsToScript = it)) },
        )
    }
}

@Composable
fun VoiceParamsSection(params: VideoDefaults, onChange: (VideoDefaults) -> Unit) {
    SectionCard(title = stringResource(R.string.section_voice)) {
        EditableDropdownField(
            label = stringResource(R.string.label_voice),
            value = params.voiceName,
            options = Options.voices,
            onValueChange = { onChange(params.copy(voiceName = it)) },
        )
        SliderField(
            label = stringResource(R.string.label_voice_volume),
            value = params.voiceVolume,
            range = 0f..2f,
            onValueChange = { onChange(params.copy(voiceVolume = it)) },
        )
        SliderField(
            label = stringResource(R.string.label_voice_rate),
            value = params.voiceRate,
            range = 0.5f..2f,
            onValueChange = { onChange(params.copy(voiceRate = it)) },
        )
    }
}

@Composable
fun MusicParamsSection(
    params: VideoDefaults,
    bgmFiles: List<String>,
    onChange: (VideoDefaults) -> Unit,
) {
    SectionCard(title = stringResource(R.string.section_music)) {
        DropdownField(
            label = stringResource(R.string.label_bgm_type),
            options = Options.bgmTypes,
            selected = params.bgmType,
            onSelect = { onChange(params.copy(bgmType = it)) },
            optionLabel = { bgmLabel(it) },
        )
        if (params.bgmType == "custom") {
            EditableDropdownField(
                label = stringResource(R.string.label_bgm_file),
                value = params.bgmFile,
                options = bgmFiles,
                onValueChange = { onChange(params.copy(bgmFile = it)) },
            )
        }
        if (params.bgmType.isNotBlank()) {
            SliderField(
                label = stringResource(R.string.label_bgm_volume),
                value = params.bgmVolume,
                range = 0f..1f,
                onValueChange = { onChange(params.copy(bgmVolume = it)) },
            )
        }
    }
}

@Composable
fun SubtitleParamsSection(params: VideoDefaults, onChange: (VideoDefaults) -> Unit) {
    SectionCard(title = stringResource(R.string.section_subtitle)) {
        SwitchRow(
            label = stringResource(R.string.label_subtitle_enabled),
            checked = params.subtitleEnabled,
            onCheckedChange = { onChange(params.copy(subtitleEnabled = it)) },
        )
        if (!params.subtitleEnabled) return@SectionCard

        DropdownField(
            label = stringResource(R.string.label_subtitle_position),
            options = Options.subtitlePositions,
            selected = params.subtitlePosition,
            onSelect = { onChange(params.copy(subtitlePosition = it)) },
            optionLabel = { subtitlePositionLabel(it) },
        )
        if (params.subtitlePosition == "custom") {
            SliderField(
                label = stringResource(R.string.label_custom_position),
                value = params.customPosition,
                range = 0f..100f,
                onValueChange = { onChange(params.copy(customPosition = it)) },
                valueLabel = { "${it.toInt()}%" },
            )
        }
        EditableDropdownField(
            label = stringResource(R.string.label_font_name),
            value = params.fontName,
            options = Options.fonts,
            onValueChange = { onChange(params.copy(fontName = it)) },
        )
        IntSliderField(
            label = stringResource(R.string.label_font_size),
            value = params.fontSize,
            range = 20..140,
            onValueChange = { onChange(params.copy(fontSize = it)) },
        )
        EditableDropdownField(
            label = stringResource(R.string.label_text_color),
            value = params.textForeColor,
            options = colorPresets,
            onValueChange = { onChange(params.copy(textForeColor = it)) },
        )
        EditableDropdownField(
            label = stringResource(R.string.label_stroke_color),
            value = params.strokeColor,
            options = colorPresets,
            onValueChange = { onChange(params.copy(strokeColor = it)) },
        )
        SliderField(
            label = stringResource(R.string.label_stroke_width),
            value = params.strokeWidth,
            range = 0f..6f,
            onValueChange = { onChange(params.copy(strokeWidth = it)) },
        )
        SwitchRow(
            label = stringResource(R.string.label_text_background),
            checked = params.textBackgroundEnabled,
            onCheckedChange = { onChange(params.copy(textBackgroundEnabled = it)) },
        )
        if (params.textBackgroundEnabled) {
            SwitchRow(
                label = stringResource(R.string.label_rounded_background),
                checked = params.roundedSubtitleBackground,
                onCheckedChange = { onChange(params.copy(roundedSubtitleBackground = it)) },
            )
        }
    }
}

@Composable
fun AdvancedParamsSection(params: VideoDefaults, onChange: (VideoDefaults) -> Unit) {
    SectionCard(title = stringResource(R.string.section_advanced)) {
        IntSliderField(
            label = stringResource(R.string.label_threads),
            value = params.nThreads,
            range = 1..8,
            onValueChange = { onChange(params.copy(nThreads = it)) },
        )
    }
}

@Composable
fun concatLabel(value: String): String = when (value) {
    "sequential" -> stringResource(R.string.concat_sequential)
    else -> stringResource(R.string.concat_random)
}

@Composable
fun transitionLabel(value: String): String = when (value) {
    "Shuffle" -> stringResource(R.string.transition_shuffle)
    "FadeIn" -> stringResource(R.string.transition_fade_in)
    "FadeOut" -> stringResource(R.string.transition_fade_out)
    "SlideIn" -> stringResource(R.string.transition_slide_in)
    "SlideOut" -> stringResource(R.string.transition_slide_out)
    "ZoomIn" -> stringResource(R.string.transition_zoom_in)
    "ZoomOut" -> stringResource(R.string.transition_zoom_out)
    else -> stringResource(R.string.transition_none)
}

@Composable
fun bgmLabel(value: String): String = when (value) {
    "custom" -> stringResource(R.string.bgm_custom)
    "random" -> stringResource(R.string.bgm_random)
    else -> stringResource(R.string.bgm_none)
}

@Composable
fun subtitlePositionLabel(value: String): String = when (value) {
    "top" -> stringResource(R.string.subtitle_top)
    "center" -> stringResource(R.string.subtitle_center)
    "custom" -> stringResource(R.string.subtitle_custom)
    else -> stringResource(R.string.subtitle_bottom)
}
