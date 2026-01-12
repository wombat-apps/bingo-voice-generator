import SwiftUI

struct BingoCellView: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState

    let number: Int

    private var hasAudio: Bool {
        appState.hasAudio(for: number)
    }

    private var isGenerating: Bool {
        generationState.isGenerating(number)
    }

    private var isPlaying: Bool {
        appState.playerService.isPlaying && appState.playerService.currentNumber == number
    }

    private var displayText: String {
        if appState.selectedMode == .bingo75 {
            let letter = Bingo75Letter.letter(for: number)
            return "\(letter)\(number)"
        }
        return "\(number)"
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(displayText)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundStyle(hasAudio ? .green : .secondary)

            HStack(spacing: 4) {
                // Play button
                Button {
                    handlePlay()
                } label: {
                    Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .disabled(!hasAudio || isGenerating)
                .help(hasAudio ? (isPlaying ? "Stop" : "Play") : "No audio")

                // Generate button
                Button {
                    handleGenerate()
                } label: {
                    if isGenerating {
                        ProgressView()
                            .scaleEffect(0.6)
                            .frame(width: 12, height: 12)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.caption)
                    }
                }
                .buttonStyle(.borderless)
                .disabled(isGenerating || !generationState.hasAPIKey)
                .help(
                    !generationState.hasAPIKey
                        ? "Enter API key above"
                        : (hasAudio ? "Regenerate" : "Generate")
                )
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(hasAudio ? Color.green.opacity(0.1) : Color.secondary.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(
                    hasAudio ? Color.green.opacity(0.3) : Color.secondary.opacity(0.2),
                    lineWidth: 1
                )
        )
    }

    private func handlePlay() {
        if isPlaying {
            appState.playerService.stop()
        } else if let audioFile = appState.audioFile(for: number) {
            appState.playerService.play(audioFile)
        }
    }

    private func handleGenerate() {
        guard let voice = appState.selectedVoice else { return }

        Task {
            do {
                let audioFile = try await generationState.generate(
                    number: number,
                    language: voice.language,
                    voice: voice,
                    mode: appState.selectedMode,
                    settings: settingsState
                )
                appState.addAudioFile(audioFile)
                appState.playerService.play(audioFile)
            } catch {
                // Error handled by generationState
            }
        }
    }
}
