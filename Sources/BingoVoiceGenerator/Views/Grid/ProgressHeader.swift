import SwiftUI

struct ProgressHeader: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        HStack {
            Text("\(appState.audioCount) / \(appState.totalCount) audios generated (\(appState.progressPercentage)%)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if appState.audioCount < appState.totalCount {
                if generationState.isBatchGenerating {
                    Button("Cancel") {
                        generationState.cancelBatchGeneration()
                    }
                    .buttonStyle(.bordered)
                } else {
                    Button("Generate All") {
                        generateAllPending()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!generationState.hasAPIKey || appState.selectedVoice == nil)
                }
            }

            Spacer()

            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(.green.opacity(0.6))
                        .frame(width: 12, height: 12)
                    Text("Has audio")
                }

                HStack(spacing: 4) {
                    Circle()
                        .fill(.secondary.opacity(0.3))
                        .frame(width: 12, height: 12)
                    Text("No audio")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    private func generateAllPending() {
        guard let voice = appState.selectedVoice else { return }

        let allNumbers = Array(1...appState.selectedMode.maxNumber)
        let pendingNumbers = allNumbers.filter { !appState.hasAudio(for: $0) }

        generationState.generateAll(
            pendingNumbers: pendingNumbers,
            language: voice.language,
            voice: voice,
            mode: appState.selectedMode,
            settings: settingsState
        ) { audioFile in
            appState.addAudioFile(audioFile)
        }
    }
}
