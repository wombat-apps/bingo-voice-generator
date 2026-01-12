import SwiftUI

struct BingoCellView: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState

    let number: Int

    // Whether this number needs two parts (10+) or just word (1-9)
    private var needsDigitPart: Bool { number >= 10 }

    private var audioPair: NumberAudioPair? {
        appState.audioPair(for: number)
    }

    private var hasWord: Bool { audioPair?.wordAudio != nil }
    private var hasDigit: Bool { audioPair?.digitAudio != nil }
    private var isComplete: Bool { audioPair?.isComplete ?? false }
    private var hasAny: Bool { audioPair?.hasAny ?? false }

    private var isGeneratingWord: Bool {
        generationState.isGenerating(number, part: .word)
    }

    private var isGeneratingDigit: Bool {
        generationState.isGenerating(number, part: .digit)
    }

    private var isGeneratingAny: Bool {
        generationState.isGenerating(number)
    }

    private var isPlayingWord: Bool {
        appState.playerService.isPlaying &&
        appState.playerService.currentNumber == number &&
        appState.playerService.currentAudioFile?.part == .word
    }

    private var isPlayingDigit: Bool {
        appState.playerService.isPlaying &&
        appState.playerService.currentNumber == number &&
        appState.playerService.currentAudioFile?.part == .digit
    }

    private var isPlayingAny: Bool {
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
        VStack(spacing: 4) {
            Text(displayText)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(hasAny ? .primary : .secondary)

            // Part indicators
            HStack(spacing: 4) {
                PartIndicator(
                    label: "W",
                    hasAudio: hasWord,
                    isGenerating: isGeneratingWord,
                    isPlaying: isPlayingWord
                )

                if needsDigitPart {
                    PartIndicator(
                        label: "D",
                        hasAudio: hasDigit,
                        isGenerating: isGeneratingDigit,
                        isPlaying: isPlayingDigit
                    )
                }
            }

            // Duration
            if let pair = audioPair, pair.hasAny {
                Text(pair.formattedDuration)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Text(" ")
                    .font(.caption2)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(backgroundFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(borderColor, lineWidth: isPlayingAny ? 2 : 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            handleTap()
        }
        .contextMenu { contextMenuItems }
        .help(helpText)
    }

    private var backgroundFill: Color {
        if isComplete {
            return Color.green.opacity(0.1)
        } else if hasAny {
            return Color.orange.opacity(0.1)
        }
        return Color.secondary.opacity(0.05)
    }

    private var borderColor: Color {
        if isPlayingAny {
            return Color.accentColor
        } else if isComplete {
            return Color.green.opacity(0.3)
        } else if hasAny {
            return Color.orange.opacity(0.3)
        }
        return Color.secondary.opacity(0.2)
    }

    @ViewBuilder
    private var contextMenuItems: some View {
        if generationState.hasAPIKey {
            // Generate missing parts
            if !hasWord {
                Button("Generate Word") {
                    generatePart(.word)
                }
            }

            if needsDigitPart && !hasDigit {
                Button("Generate Digit") {
                    generatePart(.digit)
                }
            }

            if !isComplete {
                Button("Generate All Missing") {
                    generateMissing()
                }
            }

            // Regenerate existing parts
            if hasAny {
                Divider()

                if hasWord {
                    Button("Regenerate Word") {
                        generatePart(.word)
                    }
                }

                if hasDigit {
                    Button("Regenerate Digit") {
                        generatePart(.digit)
                    }
                }

                if isComplete {
                    Button("Regenerate All") {
                        generateMissing()
                    }
                }
            }

            // Play specific parts
            if hasAny {
                Divider()

                if hasWord {
                    Button("Play Word") {
                        playPart(.word)
                    }
                }

                if hasDigit {
                    Button("Play Digit") {
                        playPart(.digit)
                    }
                }
            }
        }
    }

    private var helpText: String {
        if isGeneratingAny {
            return "Generating..."
        }
        if isComplete {
            return isPlayingAny ? "Stop" : "Play"
        }
        if hasAny {
            return "Partial - right-click to complete"
        }
        return generationState.hasAPIKey ? "Generate" : "Enter API key above"
    }

    private func handleTap() {
        if isGeneratingAny { return }

        if hasAny {
            handlePlay()
        } else if generationState.hasAPIKey {
            generateMissing()
        }
    }

    private func handlePlay() {
        if isPlayingAny {
            appState.playerService.stop()
        } else if let pair = audioPair {
            // Play all parts in sequence (word → digit)
            appState.playerService.playPair(pair)
        }
    }

    private func playPart(_ part: AudioPart) {
        if let audio = audioPair?.audio(for: part) {
            appState.playerService.play(audio)
        }
    }

    private func generatePart(_ part: AudioPart) {
        guard let voice = appState.selectedVoice else { return }

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

    private func generateMissing() {
        guard let voice = appState.selectedVoice else { return }

        let missingParts = audioPair?.missingParts ?? (needsDigitPart ? [.word, .digit] : [.word])

        Task {
            for part in missingParts {
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
                } catch {
                    // Error handled by generationState
                }
            }
            // Play all parts in sequence after generation completes
            if let pair = appState.audioPair(for: number) {
                appState.playerService.playPair(pair)
            }
        }
    }
}

// MARK: - Part Indicator

private struct PartIndicator: View {
    let label: String
    let hasAudio: Bool
    let isGenerating: Bool
    let isPlaying: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(backgroundColor)
                .frame(width: 18, height: 18)

            if isGenerating {
                ProgressView()
                    .scaleEffect(0.4)
            } else {
                Text(label)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(hasAudio ? .white : .secondary)
            }
        }
        .overlay(
            Circle()
                .stroke(isPlaying ? Color.accentColor : Color.clear, lineWidth: 2)
        )
    }

    private var backgroundColor: Color {
        if hasAudio {
            return .green.opacity(0.8)
        }
        return .secondary.opacity(0.2)
    }
}
