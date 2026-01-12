import SwiftUI

enum VoiceGender: String, CaseIterable, Identifiable {
    case all = ""
    case male = "male"
    case female = "female"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .all: "All"
        case .male: "Male"
        case .female: "Female"
        }
    }
}

@Observable
@MainActor
final class SharedVoicePickerState {
    private(set) var voices: [SharedVoice] = []
    private(set) var hasMore: Bool = false
    private(set) var isLoading: Bool = false
    private(set) var loadError: String?

    var searchText: String = ""
    var selectedGender: VoiceGender = .all

    private let elevenLabsService: ElevenLabsService
    private let previewService: PreviewAudioService
    private let pageSize: Int = 25

    init(
        elevenLabsService: ElevenLabsService = .shared,
        previewService: PreviewAudioService = .shared
    ) {
        self.elevenLabsService = elevenLabsService
        self.previewService = previewService
    }

    func loadVoices(for language: Language, apiKey: String) async {
        guard !isLoading else { return }

        isLoading = true
        loadError = nil

        do {
            let gender = selectedGender == .all ? nil : selectedGender.rawValue
            let search = searchText.isEmpty ? nil : searchText

            let response = try await elevenLabsService.searchSharedVoices(
                language: language,
                apiKey: apiKey,
                gender: gender,
                search: search,
                pageSize: pageSize
            )

            voices = response.voices
            hasMore = response.hasMore
        } catch {
            loadError = error.localizedDescription
            voices = []
            hasMore = false
        }

        isLoading = false
    }

    func reset() {
        voices = []
        hasMore = false
        isLoading = false
        loadError = nil
        searchText = ""
        selectedGender = .all
        previewService.stop()
    }

    func playPreview(for voice: SharedVoice) {
        guard let urlString = voice.previewUrl, let url = URL(string: urlString) else {
            return
        }

        if previewService.isPreviewingVoice(voice.voiceId) {
            previewService.stop()
        } else {
            previewService.play(url: url, voiceId: voice.voiceId)
        }
    }

    func stopPreview() {
        previewService.stop()
    }

    func isPreviewingVoice(_ voiceId: String) -> Bool {
        previewService.isPreviewingVoice(voiceId)
    }

    var isPreviewLoading: Bool {
        previewService.isLoading
    }

    var previewingVoiceId: String? {
        previewService.currentVoiceId
    }
}
