import SwiftUI

struct VoiceDetailView: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        VStack(spacing: 0) {
            VoiceDetailHeader()

            Divider()

            ProgressHeader()
                .padding(.horizontal)
                .padding(.top)

            ScrollView {
                BingoGridView()
                    .padding()
            }
        }
        .frame(minWidth: 600, minHeight: 500)
    }
}

// MARK: - Voice Detail Header

private struct VoiceDetailHeader: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState

    var body: some View {
        @Bindable var state = appState

        HStack {
            if let voice = appState.selectedVoice {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text(voice.language.flag)
                        Text(voice.customName)
                            .font(.headline)
                    }
                    if voice.elevenLabsName != voice.customName {
                        Text("ElevenLabs: \(voice.elevenLabsName)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    Text("Voice ID: \(voice.elevenLabsId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Picker("Mode", selection: $state.selectedMode) {
                ForEach(BingoMode.allCases) { mode in
                    Text(mode.displayName).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 200)

            if !generationState.hasAPIKey {
                Label("API key required", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding()
        .background(.regularMaterial)
    }
}
