package com.dimscm.moneyprinter.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.llm.LlmProvider
import com.dimscm.moneyprinter.data.settings.AiMode
import com.dimscm.moneyprinter.data.settings.VideoDefaults
import com.dimscm.moneyprinter.ui.components.AdvancedParamsSection
import com.dimscm.moneyprinter.ui.components.DropdownField
import com.dimscm.moneyprinter.ui.components.LabeledTextField
import com.dimscm.moneyprinter.ui.components.MusicParamsSection
import com.dimscm.moneyprinter.ui.components.SecretField
import com.dimscm.moneyprinter.ui.components.SectionCard
import com.dimscm.moneyprinter.ui.components.SubtitleParamsSection
import com.dimscm.moneyprinter.ui.components.VideoParamsSection
import com.dimscm.moneyprinter.ui.components.VoiceParamsSection

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    modifier: Modifier = Modifier,
    viewModel: SettingsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = { TopAppBar(title = { Text(stringResource(R.string.settings_title)) }) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text(stringResource(R.string.tab_server)) },
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text(stringResource(R.string.tab_ai)) },
                )
                Tab(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    text = { Text(stringResource(R.string.tab_defaults)) },
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                when (selectedTab) {
                    0 -> ServerTab(state, viewModel)
                    1 -> AiTab(state, viewModel)
                    else -> DefaultsTab(state.defaults, viewModel::onDefaultsChange, viewModel::saveDefaults)
                }
            }
        }
    }
}

@Composable
private fun ServerTab(state: SettingsUiState, viewModel: SettingsViewModel) {
    SectionCard(title = stringResource(R.string.tab_server)) {
        LabeledTextField(
            label = stringResource(R.string.label_server_url),
            value = state.serverUrl,
            onValueChange = viewModel::onServerUrlChange,
            placeholder = stringResource(R.string.hint_server_url),
            supportingText = stringResource(R.string.server_url_help),
        )
        SecretField(
            label = stringResource(R.string.label_server_api_key),
            value = state.serverApiKey,
            onValueChange = viewModel::onServerApiKeyChange,
            placeholder = stringResource(R.string.hint_server_api_key),
            supportingText = stringResource(R.string.server_api_key_help),
        )
        Button(onClick = viewModel::saveServer, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.action_save))
        }
        OutlinedButton(
            onClick = viewModel::testServer,
            enabled = !state.testingServer,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.testingServer) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            }
            Text(
                text = stringResource(R.string.action_test_connection),
                modifier = Modifier.padding(start = 6.dp),
            )
        }
    }
}

@Composable
private fun AiTab(state: SettingsUiState, viewModel: SettingsViewModel) {
    val ai = state.ai
    SectionCard(title = stringResource(R.string.label_ai_mode)) {
        AiModeOption(
            title = stringResource(R.string.ai_mode_server),
            description = stringResource(R.string.ai_mode_server_desc),
            selected = ai.mode == AiMode.SERVER,
            onClick = { viewModel.onAiChange(ai.copy(mode = AiMode.SERVER)) },
        )
        AiModeOption(
            title = stringResource(R.string.ai_mode_device),
            description = stringResource(R.string.ai_mode_device_desc),
            selected = ai.mode == AiMode.ON_DEVICE,
            onClick = { viewModel.onAiChange(ai.copy(mode = AiMode.ON_DEVICE)) },
        )
    }

    if (ai.mode == AiMode.ON_DEVICE) {
        SectionCard(title = stringResource(R.string.label_ai_provider)) {
            DropdownField(
                label = stringResource(R.string.label_ai_provider),
                options = LlmProvider.entries.toList(),
                selected = ai.provider,
                onSelect = { provider ->
                    viewModel.onAiChange(ai.copy(provider = provider, baseUrl = "", model = ""))
                },
                optionLabel = { it.displayName },
            )
            SecretField(
                label = stringResource(R.string.label_ai_api_key),
                value = ai.apiKey,
                onValueChange = { viewModel.onAiChange(ai.copy(apiKey = it)) },
                supportingText = stringResource(R.string.ai_key_help),
            )
            LabeledTextField(
                label = stringResource(R.string.label_ai_base_url),
                value = ai.baseUrl,
                onValueChange = { viewModel.onAiChange(ai.copy(baseUrl = it)) },
                placeholder = ai.provider.defaultBaseUrl,
            )
            LabeledTextField(
                label = stringResource(R.string.label_ai_model),
                value = ai.model,
                onValueChange = { viewModel.onAiChange(ai.copy(model = it)) },
                placeholder = ai.provider.defaultModel,
            )
            OutlinedButton(
                onClick = viewModel::testAi,
                enabled = !state.testingAi,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (state.testingAi) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                }
                Text(
                    text = stringResource(R.string.action_test_ai),
                    modifier = Modifier.padding(start = 6.dp),
                )
            }
        }
    }

    Button(onClick = viewModel::saveAi, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.action_save))
    }
}

@Composable
private fun AiModeOption(
    title: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            },
        ),
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = selected, onClick = onClick)
                Text(text = title, style = MaterialTheme.typography.titleSmall)
            }
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun DefaultsTab(
    defaults: VideoDefaults,
    onChange: (VideoDefaults) -> Unit,
    onSave: () -> Unit,
) {
    Text(
        text = stringResource(R.string.defaults_help),
        style = MaterialTheme.typography.bodyMedium,
    )
    VideoParamsSection(defaults, onChange)
    VoiceParamsSection(defaults, onChange)
    MusicParamsSection(defaults, emptyList(), onChange)
    SubtitleParamsSection(defaults, onChange)
    AdvancedParamsSection(defaults, onChange)
    Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.action_save))
    }
}
