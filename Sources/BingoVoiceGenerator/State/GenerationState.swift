import SwiftUI

/// Identifies a specific generation task (number + part)
struct GenerationTask: Hashable, Sendable {
    let number: Int
    let part: AudioPart
}

@Observable
@MainActor
final class GenerationState {
    // Currently generating tasks (number + part)
    private(set) var generatingTasks: Set<GenerationTask> = []

    // Batch generation
    private(set) var isBatchGenerating: Bool = false
    private var batchTask: Task<Void, Never>?

    // Error handling
    var lastError: GenerationError?
    var showingError: Bool = false

    // API Key
    private(set) var apiKey: String = ""

    var hasAPIKey: Bool { !apiKey.isEmpty }

    // Subscription info
    private(set) var subscription: SubscriptionInfo?

    // Services
    let elevenLabsService: ElevenLabsService
    let storageService: AudioStorageService
    let keychainService: KeychainService

    init(
        elevenLabsService: ElevenLabsService = .shared,
        storageService: AudioStorageService = .shared,
        keychainService: KeychainService = .shared
    ) {
        self.elevenLabsService = elevenLabsService
        self.storageService = storageService
        self.keychainService = keychainService
    }

    func loadAPIKey() async {
        if let key = await keychainService.loadAPIKey() {
            apiKey = key
            await refreshSubscription()
        }
    }

    func saveAPIKey(_ key: String) async {
        do {
            try await keychainService.saveAPIKey(key)
            apiKey = key
            await refreshSubscription()
        } catch {
            lastError = .keychainError(error.localizedDescription)
            showingError = true
        }
    }

    func refreshSubscription() async {
        guard hasAPIKey else {
            subscription = nil
            return
        }
        do {
            subscription = try await elevenLabsService.getSubscription(apiKey: apiKey)
        } catch {
            // Silent failure - don't block on subscription errors
        }
    }

    /// Check if any part of a number is generating
    func isGenerating(_ number: Int) -> Bool {
        generatingTasks.contains { $0.number == number }
    }

    /// Check if a specific part is generating
    func isGenerating(_ number: Int, part: AudioPart) -> Bool {
        generatingTasks.contains(GenerationTask(number: number, part: part))
    }

    /// Generate a specific part for a number
    func generate(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode,
        part: AudioPart,
        settings: SettingsState
    ) async throws -> AudioFile {
        let task = GenerationTask(number: number, part: part)

        guard !generatingTasks.contains(task) else {
            throw GenerationError.alreadyGenerating
        }

        guard hasAPIKey else {
            throw GenerationError.noAPIKey
        }

        generatingTasks.insert(task)
        defer { generatingTasks.remove(task) }

        do {
            let audioFile = try await attemptGeneration(
                number: number,
                language: language,
                voice: voice,
                mode: mode,
                part: part,
                settings: settings
            )
            await refreshSubscription()
            return audioFile
        } catch ElevenLabsError.voiceLimitReached {
            // Delete oldest custom voice and retry
            do {
                try await deleteOldestCustomVoice()
                let audioFile = try await attemptGeneration(
                    number: number,
                    language: language,
                    voice: voice,
                    mode: mode,
                    part: part,
                    settings: settings
                )
                await refreshSubscription()
                return audioFile
            } catch {
                lastError = .apiError("Voice limit retry failed: \(error.localizedDescription)")
                showingError = true
                throw error
            }
        } catch {
            lastError = .apiError(error.localizedDescription)
            showingError = true
            throw error
        }
    }

    private func attemptGeneration(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode,
        part: AudioPart,
        settings: SettingsState
    ) async throws -> AudioFile {
        // Build TTS text for the specific part
        let text = TextBuilder.buildText(
            number: number,
            language: language,
            mode: mode,
            part: part
        )

        // Call ElevenLabs API with configurable settings
        let audioData = try await elevenLabsService.generateSpeech(
            text: text,
            voiceId: voice.elevenLabsId,
            languageCode: language.elevenLabsCode,
            apiKey: apiKey,
            modelId: settings.selectedModel.rawValue,
            outputFormat: settings.outputFormat.rawValue,
            voiceSettings: settings.voiceSettings.asDictionary,
            speed: settings.speed
        )

        // Save to local storage
        var audioFile = try await storageService.saveAudioFile(
            data: audioData,
            number: number,
            language: language,
            voice: voice,
            mode: mode,
            part: part
        )

        // Auto-trim trailing silence
        do {
            let result = try await SilenceTrimmingService.shared.trimSilence(from: audioFile)
            audioFile = audioFile.withDuration(result.trimmedDuration)
        } catch SilenceTrimmingService.TrimmingError.noSignificantSilence {
            // No trailing silence to trim - keep original file as-is
        } catch {
            // Other trimming errors - don't fail generation, audio is still valid
        }

        return audioFile
    }

    private func deleteOldestCustomVoice() async throws {
        // Get all voices from ElevenLabs
        let voices = try await elevenLabsService.listVoices(apiKey: apiKey)

        // Filter to only custom voices (not premade)
        let customVoices = voices.filter { $0.isCustomVoice }

        guard !customVoices.isEmpty else {
            throw ElevenLabsError.noCustomVoicesToDelete
        }

        // Sort by creation date (oldest first) - voices without date go first
        let sorted = customVoices.sorted { v1, v2 in
            let date1 = v1.createdAtUnix ?? 0
            let date2 = v2.createdAtUnix ?? 0
            return date1 < date2
        }

        // Delete the oldest voice
        let oldestVoice = sorted[0]
        try await elevenLabsService.deleteVoice(voiceId: oldestVoice.voiceId, apiKey: apiKey)
    }

    // MARK: - Batch Generation

    func cancelBatchGeneration() {
        batchTask?.cancel()
        isBatchGenerating = false
    }

    /// Generate all missing parts for all pending numbers
    func generateAll(
        pendingNumbers: [Int],
        language: Language,
        voice: Voice,
        mode: BingoMode,
        settings: SettingsState,
        onGenerated: @escaping (AudioFile) -> Void
    ) {
        guard !isBatchGenerating else { return }

        isBatchGenerating = true
        batchTask = Task {
            for number in pendingNumbers {
                guard !Task.isCancelled else { break }

                // Determine which parts to generate
                // Single digits (1-9): only word part
                // Two digits (10+): both word and digit parts
                let partsToGenerate: [AudioPart] = number < 10 ? [.word] : [.word, .digit]

                for part in partsToGenerate {
                    guard !Task.isCancelled else { break }

                    do {
                        let audioFile = try await generate(
                            number: number,
                            language: language,
                            voice: voice,
                            mode: mode,
                            part: part,
                            settings: settings
                        )
                        onGenerated(audioFile)
                    } catch {
                        // Continue with next part/number
                    }
                }
            }
            isBatchGenerating = false
        }
    }
}

enum GenerationError: LocalizedError {
    case alreadyGenerating
    case noAPIKey
    case apiError(String)
    case keychainError(String)

    var errorDescription: String? {
        switch self {
        case .alreadyGenerating:
            "Already generating this number"
        case .noAPIKey:
            "Please set your ElevenLabs API key in Settings"
        case .apiError(let message):
            message
        case .keychainError(let message):
            "Keychain error: \(message)"
        }
    }
}
