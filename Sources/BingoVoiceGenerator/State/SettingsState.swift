import SwiftUI

@Observable
@MainActor
final class SettingsState {
    // MARK: - Voice Settings (sliders 0-1)

    var stability: Double = VoiceSettings.default.stability {
        didSet { saveSettings() }
    }

    var similarityBoost: Double = VoiceSettings.default.similarityBoost {
        didSet { saveSettings() }
    }

    var style: Double = VoiceSettings.default.style {
        didSet { saveSettings() }
    }

    var useSpeakerBoost: Bool = VoiceSettings.default.useSpeakerBoost {
        didSet { saveSettings() }
    }

    // MARK: - Model & Format

    var selectedModel: ElevenLabsModel = .elevenV3 {
        didSet { saveSettings() }
    }

    var outputFormat: OutputFormat = .mp3_44100_128 {
        didSet { saveSettings() }
    }

    // MARK: - Sidebar State

    var isSidebarVisible: Bool = true {
        didSet {
            UserDefaults.standard.set(isSidebarVisible, forKey: Keys.sidebarVisible)
        }
    }

    // MARK: - Computed

    var voiceSettings: VoiceSettings {
        VoiceSettings(
            stability: stability,
            similarityBoost: similarityBoost,
            style: style,
            useSpeakerBoost: useSpeakerBoost
        )
    }

    // MARK: - Persistence Keys

    private enum Keys {
        static let stability = "elevenLabs.stability"
        static let similarityBoost = "elevenLabs.similarityBoost"
        static let style = "elevenLabs.style"
        static let useSpeakerBoost = "elevenLabs.useSpeakerBoost"
        static let model = "elevenLabs.model"
        static let outputFormat = "elevenLabs.outputFormat"
        static let sidebarVisible = "sidebar.visible"
    }

    // MARK: - Init

    init() {
        loadSettings()
    }

    // MARK: - Persistence

    private func loadSettings() {
        let defaults = UserDefaults.standard

        if defaults.object(forKey: Keys.stability) != nil {
            stability = defaults.double(forKey: Keys.stability)
        }
        if defaults.object(forKey: Keys.similarityBoost) != nil {
            similarityBoost = defaults.double(forKey: Keys.similarityBoost)
        }
        if defaults.object(forKey: Keys.style) != nil {
            style = defaults.double(forKey: Keys.style)
        }
        if defaults.object(forKey: Keys.useSpeakerBoost) != nil {
            useSpeakerBoost = defaults.bool(forKey: Keys.useSpeakerBoost)
        }

        if let modelRaw = defaults.string(forKey: Keys.model),
           let model = ElevenLabsModel(rawValue: modelRaw)
        {
            selectedModel = model
        }

        if let formatRaw = defaults.string(forKey: Keys.outputFormat),
           let format = OutputFormat(rawValue: formatRaw)
        {
            outputFormat = format
        }

        if defaults.object(forKey: Keys.sidebarVisible) != nil {
            isSidebarVisible = defaults.bool(forKey: Keys.sidebarVisible)
        }
    }

    private func saveSettings() {
        let defaults = UserDefaults.standard
        defaults.set(stability, forKey: Keys.stability)
        defaults.set(similarityBoost, forKey: Keys.similarityBoost)
        defaults.set(style, forKey: Keys.style)
        defaults.set(useSpeakerBoost, forKey: Keys.useSpeakerBoost)
        defaults.set(selectedModel.rawValue, forKey: Keys.model)
        defaults.set(outputFormat.rawValue, forKey: Keys.outputFormat)
    }

    func resetToDefaults() {
        stability = VoiceSettings.default.stability
        similarityBoost = VoiceSettings.default.similarityBoost
        style = VoiceSettings.default.style
        useSpeakerBoost = VoiceSettings.default.useSpeakerBoost
        selectedModel = .elevenV3
        outputFormat = .mp3_44100_128
    }
}
