import SwiftUI

struct VoiceSettingsSection: View {
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        @Bindable var settings = settingsState

        VStack(alignment: .leading, spacing: 16) {
            Text("Voice Settings")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            StabilityPicker(value: $settings.stability)

            SettingsSlider(
                title: "Similarity Boost",
                value: $settings.similarityBoost,
                description: "How closely to match the original voice"
            )

            SettingsSlider(
                title: "Style",
                value: $settings.style,
                description: "Style exaggeration (use sparingly)"
            )

            Toggle("Speaker Boost", isOn: $settings.useSpeakerBoost)
                .toggleStyle(.switch)
                .controlSize(.small)

            Text("Enhances voice clarity")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}

// MARK: - Reusable Slider Component

struct SettingsSlider: View {
    let title: String
    @Binding var value: Double
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.subheadline)
                Spacer()
                Text(String(format: "%.2f", value))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            Slider(value: $value, in: 0 ... 1, step: 0.01)
                .controlSize(.small)

            Text(description)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}

// MARK: - Stability Picker (v3 requires 0.0, 0.5, or 1.0)

struct StabilityPicker: View {
    @Binding var value: Double

    private enum StabilityLevel: Double, CaseIterable {
        case creative = 0.0
        case natural = 0.5
        case robust = 1.0

        var label: String {
            switch self {
            case .creative: "Creative"
            case .natural: "Natural"
            case .robust: "Robust"
            }
        }
    }

    private var selectedLevel: StabilityLevel {
        if value < 0.25 { return .creative }
        if value < 0.75 { return .natural }
        return .robust
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Stability")
                .font(.subheadline)

            Picker("Stability", selection: Binding(
                get: { selectedLevel },
                set: { value = $0.rawValue }
            )) {
                ForEach(StabilityLevel.allCases, id: \.self) { level in
                    Text(level.label).tag(level)
                }
            }
            .pickerStyle(.segmented)
            .controlSize(.small)

            Text("Creative = expressive, Robust = consistent")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}
