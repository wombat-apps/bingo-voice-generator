import SwiftUI

@Observable
@MainActor
final class VoiceStore {
    private(set) var voices: [Voice] = []
    private(set) var favoriteVoiceUUIDs: Set<UUID> = []

    private let userDefaultsKey = "customVoices"
    private let favoritesKey = "favoriteVoices"

    init() {
        loadVoices()
        loadFavorites()
    }

    // MARK: - Favorites

    func isFavorite(_ voice: Voice) -> Bool {
        favoriteVoiceUUIDs.contains(voice.uuid)
    }

    func toggleFavorite(_ voice: Voice) {
        if favoriteVoiceUUIDs.contains(voice.uuid) {
            favoriteVoiceUUIDs.remove(voice.uuid)
        } else {
            favoriteVoiceUUIDs.insert(voice.uuid)
        }
        saveFavorites()
    }

    private func loadFavorites() {
        guard let data = UserDefaults.standard.data(forKey: favoritesKey),
              let decoded = try? JSONDecoder().decode(Set<UUID>.self, from: data) else {
            return
        }
        favoriteVoiceUUIDs = decoded
    }

    private func saveFavorites() {
        guard let data = try? JSONEncoder().encode(favoriteVoiceUUIDs) else { return }
        UserDefaults.standard.set(data, forKey: favoritesKey)
    }

    // MARK: - Computed Properties

    var voicesByLanguage: [Language: [Voice]] {
        Dictionary(grouping: voices, by: \.language)
    }

    func voices(for language: Language) -> [Voice] {
        voices
            .filter { $0.language == language }
            .sorted { $0.customName.localizedCaseInsensitiveCompare($1.customName) == .orderedAscending }
    }

    var isEmpty: Bool { voices.isEmpty }

    // MARK: - CRUD Operations

    func addVoice(_ voice: Voice) {
        voices.append(voice)
        saveVoices()
    }

    func updateVoice(_ voice: Voice) {
        if let index = voices.firstIndex(where: { $0.uuid == voice.uuid }) {
            voices[index] = voice
            saveVoices()
        }
    }

    func deleteVoice(_ voice: Voice) {
        voices.removeAll { $0.uuid == voice.uuid }
        saveVoices()
    }

    func deleteVoices(at offsets: IndexSet, in language: Language) {
        let languageVoices = voices(for: language)
        let voicesToDelete = offsets.map { languageVoices[$0] }
        voices.removeAll { voice in voicesToDelete.contains { $0.uuid == voice.uuid } }
        saveVoices()
    }

    // MARK: - Persistence

    private func loadVoices() {
        guard let data = UserDefaults.standard.data(forKey: userDefaultsKey),
              let decoded = try? JSONDecoder().decode([Voice].self, from: data) else {
            return
        }
        voices = decoded
    }

    private func saveVoices() {
        guard let data = try? JSONEncoder().encode(voices) else { return }
        UserDefaults.standard.set(data, forKey: userDefaultsKey)
    }
}
