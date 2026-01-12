import SwiftUI

struct NowPlayingBar: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState
    @State private var waveformData: WaveformData?
    @State private var waveformLoadTask: Task<Void, Never>?

    private var isDisabled: Bool {
        !appState.hasAnyAudio
    }

    private var isPlaying: Bool {
        appState.playerService.isPlaying
    }

    private var currentNumber: Int? {
        appState.playerService.currentNumber
    }

    private var currentAudioFile: AudioFile? {
        appState.playerService.currentAudioFile
    }

    private var currentPart: AudioPart? {
        currentAudioFile?.part
    }

    private var currentPair: NumberAudioPair? {
        guard let number = currentNumber else { return nil }
        return appState.audioPair(for: number)
    }

    private var displayNumber: String {
        guard let number = currentNumber else {
            return "—"
        }
        if appState.selectedMode == .bingo75 {
            let letter = Bingo75Letter.letter(for: number)
            return "\(letter)\(number)"
        }
        return "\(number)"
    }

    private var isGeneratingCurrent: Bool {
        guard let number = currentNumber, let part = currentPart else { return false }
        return generationState.isGenerating(number, part: part)
    }

    var body: some View {
        HStack(spacing: 16) {
            // Playback controls
            HStack(spacing: 8) {
                // Previous button
                Button {
                    appState.playPrevious()
                } label: {
                    Image(systemName: "backward.fill")
                        .font(.body)
                }
                .buttonStyle(.borderless)
                .disabled(isDisabled)
                .help("Previous")

                // Play/Stop button
                Button {
                    handlePlayStop()
                } label: {
                    Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                        .font(.title3)
                }
                .buttonStyle(.borderless)
                .disabled(isDisabled)
                .help(isPlaying ? "Stop" : "Play")

                // Next button
                Button {
                    appState.playNext()
                } label: {
                    Image(systemName: "forward.fill")
                        .font(.body)
                }
                .buttonStyle(.borderless)
                .disabled(isDisabled)
                .help("Next")

                Divider()
                    .frame(height: 20)

                // Regenerate button
                Button {
                    handleRegenerate()
                } label: {
                    if isGeneratingCurrent {
                        ProgressView()
                            .scaleEffect(0.6)
                            .frame(width: 16, height: 16)
                    } else {
                        Image(systemName: "arrow.clockwise")
                            .font(.body)
                    }
                }
                .buttonStyle(.borderless)
                .disabled(currentNumber == nil || currentPart == nil || isGeneratingCurrent || !generationState.hasAPIKey)
                .help(regenerateHelpText)
            }

            Divider()
                .frame(height: 20)

            // Current number display
            Text(displayNumber)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundStyle(isDisabled ? .secondary : .primary)
                .monospacedDigit()
                .frame(minWidth: 40)

            // Part selector (W/D buttons)
            if let pair = currentPair {
                HStack(spacing: 4) {
                    PartButton(
                        label: "W",
                        isSelected: currentPart == .word,
                        isAvailable: pair.wordAudio != nil,
                        action: { playPart(.word) }
                    )

                    if pair.needsDigit {
                        PartButton(
                            label: "D",
                            isSelected: currentPart == .digit,
                            isAvailable: pair.digitAudio != nil,
                            action: { playPart(.digit) }
                        )
                    }
                }
            }

            // Waveform slider area
            if currentAudioFile != nil {
                WaveformSlider(
                    waveformData: waveformData,
                    currentTime: appState.playerService.currentTime,
                    duration: appState.playerService.duration,
                    onSeek: { time in
                        appState.playerService.seek(to: time)
                    }
                )
                .frame(maxWidth: 200)

                TimeDisplay(
                    currentTime: appState.playerService.currentTime,
                    duration: appState.playerService.duration
                )
            }

            Spacer()

            // Audio count indicator
            Text("\(appState.audioCount) / \(appState.totalCount)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.regularMaterial)
        .onChange(of: currentAudioFile) { _, newFile in
            loadWaveform(for: newFile)
        }
        .onAppear {
            loadWaveform(for: currentAudioFile)
        }
    }

    private var regenerateHelpText: String {
        if !generationState.hasAPIKey {
            return "Enter API key"
        }
        if currentNumber == nil {
            return "No number selected"
        }
        if let part = currentPart {
            return "Regenerate \(part.displayName)"
        }
        return "Regenerate"
    }

    private func handlePlayStop() {
        if isPlaying {
            appState.playerService.stop()
        } else if let number = currentNumber, let pair = appState.audioPair(for: number) {
            // Resume playing all parts in sequence
            appState.playerService.playPair(pair)
        } else {
            // Play the first available audio
            appState.playFirst()
        }
    }

    private func playPart(_ part: AudioPart) {
        guard let number = currentNumber,
              let pair = appState.audioPair(for: number),
              let audio = pair.audio(for: part) else { return }
        appState.playerService.play(audio)
    }

    private func handleRegenerate() {
        guard let number = currentNumber,
              let part = currentPart,
              let voice = appState.selectedVoice else { return }

        Task {
            do {
                let audioFile = try await generationState.generate(
                    number: number,
                    language: voice.language,
                    voice: voice,
                    mode: appState.selectedMode,
                    part: part,
                    settings: settingsState
                )
                appState.addAudioFile(audioFile)
                appState.playerService.play(audioFile)
            } catch {
                // Error handled by generationState
            }
        }
    }

    private func loadWaveform(for audioFile: AudioFile?) {
        waveformLoadTask?.cancel()

        guard let audioFile else {
            waveformData = nil
            return
        }

        waveformLoadTask = Task {
            let data = await WaveformService.shared.getWaveform(for: audioFile)
            if !Task.isCancelled {
                waveformData = data
            }
        }
    }
}

// MARK: - Part Button

private struct PartButton: View {
    let label: String
    let isSelected: Bool
    let isAvailable: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(foregroundColor)
                .frame(width: 22, height: 22)
                .background(backgroundColor)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isAvailable)
    }

    private var backgroundColor: Color {
        if isSelected {
            return .accentColor.opacity(0.2)
        } else if isAvailable {
            return .green.opacity(0.3)
        }
        return .secondary.opacity(0.1)
    }

    private var foregroundColor: Color {
        if isAvailable {
            return .primary
        }
        return .secondary.opacity(0.5)
    }
}
