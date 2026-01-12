import SwiftUI

@Observable
@MainActor
final class GenerationState {
    // Currently generating numbers
    private(set) var generatingNumbers: Set<Int> = []

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

    func isGenerating(_ number: Int) -> Bool {
        generatingNumbers.contains(number)
    }

    func generate(
        number: Int,
        language: Language,
        voice: Voice,
        mode: BingoMode,
        settings: SettingsState
    ) async throws -> AudioFile {
        guard !generatingNumbers.contains(number) else {
            throw GenerationError.alreadyGenerating
        }

        guard hasAPIKey else {
            throw GenerationError.noAPIKey
        }

        generatingNumbers.insert(number)
        defer { generatingNumbers.remove(number) }

        do {
            let audioFile = try await attemptGeneration(
                number: number,
                language: language,
                voice: voice,
                mode: mode,
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
        settings: SettingsState
    ) async throws -> AudioFile {
        // Build TTS text
        let text = TextBuilder.buildText(
            number: number,
            language: language,
            mode: mode
        )

        // Call ElevenLabs API with configurable settings
        let audioData = try await elevenLabsService.generateSpeech(
            text: text,
            voiceId: voice.elevenLabsId,
            languageCode: language.elevenLabsCode,
            apiKey: apiKey,
            modelId: settings.selectedModel.rawValue,
            outputFormat: settings.outputFormat.rawValue,
            voiceSettings: settings.voiceSettings.asDictionary
        )

        // Save to local storage
        let audioFile = try await storageService.saveAudioFile(
            data: audioData,
            number: number,
            language: language,
            voice: voice,
            mode: mode
        )

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

                do {
                    let audioFile = try await generate(
                        number: number,
                        language: language,
                        voice: voice,
                        mode: mode,
                        settings: settings
                    )
                    onGenerated(audioFile)
                } catch {
                    // Continue with next number
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
