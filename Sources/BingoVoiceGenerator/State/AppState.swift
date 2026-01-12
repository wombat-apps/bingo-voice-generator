import SwiftUI

@Observable
@MainActor
final class AppState {
    // Selected voice (optional - nil when no voices exist)
    var selectedVoice: Voice? {
        didSet { Task { await refreshAudioFiles() } }
    }

    // Mode per voice (persisted)
    private var modeByVoice: [UUID: BingoMode] = [:] {
        didSet { saveModes() }
    }

    // Current mode for selected voice
    var selectedMode: BingoMode {
        get {
            guard let voice = selectedVoice else { return .bingo90 }
            return modeByVoice[voice.uuid] ?? .bingo90
        }
        set {
            guard let voice = selectedVoice else { return }
            modeByVoice[voice.uuid] = newValue
            Task { await refreshAudioFiles() }
        }
    }

    // Derived from selected voice
    var selectedLanguage: Language? {
        selectedVoice?.language
    }

    // Audio file cache (number -> pair of word/digit files)
    private(set) var audioFiles: [Int: NumberAudioPair] = [:]

    // Services
    let storageService: AudioStorageService
    let playerService: AudioPlayerService

    // Computed - counts complete numbers (all required parts present)
    var audioCount: Int {
        audioFiles.values.filter { $0.isComplete }.count
    }

    // Count of numbers with partial audio (some but not all parts)
    var partialCount: Int {
        audioFiles.values.filter { $0.hasAny && !$0.isComplete }.count
    }

    var totalCount: Int { selectedMode.maxNumber }

    var progressPercentage: Int {
        guard totalCount > 0 else { return 0 }
        return Int((Double(audioCount) / Double(totalCount)) * 100)
    }

    var hasSelectedVoice: Bool { selectedVoice != nil }

    // Navigation helpers for NowPlayingBar
    var hasAnyAudio: Bool {
        audioFiles.values.contains { $0.hasAny }
    }

    var sortedAvailableNumbers: [Int] {
        audioFiles.filter { $0.value.hasAny }.keys.sorted()
    }

    /// The currently selected number in the player (or nil if nothing selected)
    var currentPlayerNumber: Int? {
        playerService.currentNumber
    }

    /// Returns the previous available audio number, or nil if at the start
    func previousAudioNumber(from current: Int) -> Int? {
        let sorted = sortedAvailableNumbers
        guard let index = sorted.firstIndex(of: current), index > 0 else {
            return sorted.last // Wrap to end
        }
        return sorted[index - 1]
    }

    /// Returns the next available audio number, or nil if at the end
    func nextAudioNumber(from current: Int) -> Int? {
        let sorted = sortedAvailableNumbers
        guard let index = sorted.firstIndex(of: current), index < sorted.count - 1 else {
            return sorted.first // Wrap to start
        }
        return sorted[index + 1]
    }

    /// Play the previous audio in the sorted list (plays all parts in sequence)
    func playPrevious() {
        let current = playerService.currentNumber ?? sortedAvailableNumbers.first
        guard let current, let prev = previousAudioNumber(from: current),
              let pair = audioFiles[prev] else { return }
        playerService.playPair(pair)
    }

    /// Play the next audio in the sorted list (plays all parts in sequence)
    func playNext() {
        let current = playerService.currentNumber ?? sortedAvailableNumbers.last
        guard let current, let next = nextAudioNumber(from: current),
              let pair = audioFiles[next] else { return }
        playerService.playPair(pair)
    }

    /// Play the first available audio (for initial play button)
    func playFirst() {
        guard let first = sortedAvailableNumbers.first,
              let pair = audioFiles[first] else { return }
        playerService.playPair(pair)
    }

    init(
        storageService: AudioStorageService = .shared,
        playerService: AudioPlayerService = .shared
    ) {
        self.storageService = storageService
        self.playerService = playerService
        loadModes()
    }

    func refreshAudioFiles() async {
        guard let voice = selectedVoice else {
            audioFiles = [:]
            return
        }
        audioFiles = await storageService.loadAudioFiles(
            language: voice.language,
            voice: voice,
            mode: selectedMode
        )
    }

    func addAudioFile(_ audioFile: AudioFile) {
        let number = audioFile.number
        if audioFiles[number] == nil {
            audioFiles[number] = NumberAudioPair(number: number)
        }

        switch audioFile.part {
        case .word:
            audioFiles[number]?.wordAudio = audioFile
        case .digit:
            audioFiles[number]?.digitAudio = audioFile
        }
    }

    /// Check if a number has complete audio (all required parts)
    func hasAudio(for number: Int) -> Bool {
        audioFiles[number]?.isComplete ?? false
    }

    /// Check if a number has a specific part
    func hasAudio(for number: Int, part: AudioPart) -> Bool {
        audioFiles[number]?.has(part) ?? false
    }

    /// Check if a number has any audio at all
    func hasAnyAudio(for number: Int) -> Bool {
        audioFiles[number]?.hasAny ?? false
    }

    /// Get the audio pair for a number
    func audioPair(for number: Int) -> NumberAudioPair? {
        audioFiles[number]
    }

    /// Get a specific audio file part
    func audioFile(for number: Int, part: AudioPart) -> AudioFile? {
        audioFiles[number]?.audio(for: part)
    }

    /// Updates the duration of an audio file after trimming
    /// Creates a new AudioFile with updated duration since AudioFile is immutable
    func updateAudioFileDuration(_ audioFile: AudioFile, newDuration: TimeInterval) {
        let number = audioFile.number
        guard audioFiles[number] != nil else { return }

        // Create updated AudioFile with new duration
        let updated = AudioFile(
            number: audioFile.number,
            part: audioFile.part,
            language: audioFile.language,
            voice: audioFile.voice,
            mode: audioFile.mode,
            fileURL: audioFile.fileURL,
            createdAt: audioFile.createdAt,
            duration: newDuration
        )

        switch audioFile.part {
        case .word:
            audioFiles[number]?.wordAudio = updated
        case .digit:
            audioFiles[number]?.digitAudio = updated
        }
    }

    // Select first voice from store (helper)
    func selectFirstVoice(from store: VoiceStore) {
        selectedVoice = store.voices.first
    }

    // MARK: - Mode Persistence

    private let modesKey = "voiceModes"

    private func loadModes() {
        guard let data = UserDefaults.standard.data(forKey: modesKey),
              let decoded = try? JSONDecoder().decode([UUID: BingoMode].self, from: data) else {
            return
        }
        modeByVoice = decoded
    }

    private func saveModes() {
        guard let data = try? JSONEncoder().encode(modeByVoice) else { return }
        UserDefaults.standard.set(data, forKey: modesKey)
    }
}
