package com.dimscm.moneyprinter.ui.create

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.settings.AiMode
import com.dimscm.moneyprinter.data.settings.Options
import com.dimscm.moneyprinter.ui.components.AdvancedParamsSection
import com.dimscm.moneyprinter.ui.components.DropdownField
import com.dimscm.moneyprinter.ui.components.IntSliderField
import com.dimscm.moneyprinter.ui.components.LabeledTextField
import com.dimscm.moneyprinter.ui.components.MusicParamsSection
import com.dimscm.moneyprinter.ui.components.SectionCard
import com.dimscm.moneyprinter.ui.components.SubtitleParamsSection
import com.dimscm.moneyprinter.ui.components.VideoParamsSection
import com.dimscm.moneyprinter.ui.components.VoiceParamsSection

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateScreen(
    onTaskCreated: (String) -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CreateViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }
    LaunchedEffect(state.createdTaskId) {
        state.createdTaskId?.let {
            onTaskCreated(it)
            viewModel.consumeCreatedTask()
        }
    }
    LaunchedEffect(state.params.bgmType) {
        if (state.params.bgmType == "custom") viewModel.refreshBgmFiles()
    }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text(stringResource(R.string.create_title)) }) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (!state.serverConfigured) {
                ServerMissingCard(onOpenSettings)
            }

            ContentSection(state, viewModel)
            VideoParamsSection(state.params, viewModel::onParamsChange)
            VoiceParamsSection(state.params, viewModel::onParamsChange)
            MusicParamsSection(state.params, state.bgmFiles, viewModel::onParamsChange)
            SubtitleParamsSection(state.params, viewModel::onParamsChange)
            AdvancedParamsSection(state.params, viewModel::onParamsChange)

            Button(
                onClick = viewModel::submit,
                enabled = !state.busy && state.serverConfigured,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.submitting) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Filled.Movie, contentDescription = null)
                }
                Text(
                    text = stringResource(R.string.action_start),
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
            TextButton(
                onClick = viewModel::reset,
                enabled = !state.busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.action_reset))
            }
        }
    }
}

@Composable
private fun ServerMissingCard(onOpenSettings: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.msg_no_server),
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            TextButton(onClick = onOpenSettings) {
                Text(stringResource(R.string.nav_settings))
            }
        }
    }
}

@Composable
private fun ContentSection(state: CreateUiState, viewModel: CreateViewModel) {
    SectionCard(title = stringResource(R.string.section_content)) {
        LabeledTextField(
            label = stringResource(R.string.label_subject),
            value = state.subject,
            onValueChange = viewModel::onSubjectChange,
            placeholder = stringResource(R.string.hint_subject),
        )

        DropdownField(
            label = stringResource(R.string.label_language),
            options = Options.languages,
            selected = state.params.language,
            onSelect = { viewModel.onParamsChange(state.params.copy(language = it)) },
            optionLabel = { it.ifBlank { stringResource(R.string.language_auto) } },
        )

        IntSliderField(
            label = stringResource(R.string.label_paragraphs),
            value = state.params.paragraphNumber,
            range = 1..10,
            onValueChange = { viewModel.onParamsChange(state.params.copy(paragraphNumber = it)) },
        )

        LabeledTextField(
            label = stringResource(R.string.label_script_prompt),
            value = state.scriptPrompt,
            onValueChange = viewModel::onScriptPromptChange,
            placeholder = stringResource(R.string.hint_script_prompt),
            singleLine = false,
            minLines = 2,
        )

        LabeledTextField(
            label = stringResource(R.string.label_script),
            value = state.script,
            onValueChange = viewModel::onScriptChange,
            placeholder = stringResource(R.string.hint_script),
            singleLine = false,
            minLines = 6,
        )

        OutlinedButton(
            onClick = viewModel::generateScript,
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.generatingScript) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.Filled.AutoAwesome, contentDescription = null)
            }
            Text(
                text = stringResource(
                    if (state.generatingScript) R.string.msg_generating else R.string.action_generate_script,
                ),
                modifier = Modifier.padding(start = 6.dp),
            )
        }

        LabeledTextField(
            label = stringResource(R.string.label_terms),
            value = state.terms,
            onValueChange = viewModel::onTermsChange,
            placeholder = stringResource(R.string.hint_terms),
            singleLine = false,
            minLines = 2,
        )

        OutlinedButton(
            onClick = viewModel::generateTerms,
            enabled = !state.busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.generatingTerms) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.Filled.AutoAwesome, contentDescription = null)
            }
            Text(
                text = stringResource(
                    if (state.generatingTerms) R.string.msg_generating else R.string.action_generate_terms,
                ),
                modifier = Modifier.padding(start = 6.dp),
            )
        }

        Text(
            text = stringResource(
                if (state.aiMode == AiMode.ON_DEVICE) R.string.ai_mode_device_desc else R.string.ai_mode_server_desc,
            ),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
