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

    // Audio file cache (number -> AudioFile)
    private(set) var audioFiles: [Int: AudioFile] = [:]

    // Services
    let storageService: AudioStorageService
    let playerService: AudioPlayerService

    // Computed
    var audioCount: Int { audioFiles.count }
    var totalCount: Int { selectedMode.maxNumber }
    var progressPercentage: Int {
        guard totalCount > 0 else { return 0 }
        return Int((Double(audioCount) / Double(totalCount)) * 100)
    }

    var hasSelectedVoice: Bool { selectedVoice != nil }

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
        audioFiles[audioFile.number] = audioFile
    }

    func hasAudio(for number: Int) -> Bool {
        audioFiles[number] != nil
    }

    func audioFile(for number: Int) -> AudioFile? {
        audioFiles[number]
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
