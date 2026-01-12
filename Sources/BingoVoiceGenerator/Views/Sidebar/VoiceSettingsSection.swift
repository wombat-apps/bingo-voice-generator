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

            VStack(alignment: .leading, spacing: 4) {
                Text("Stability")
                    .font(.subheadline)

                Picker("Stability", selection: $settings.stability) {
                    Text("Creative").tag(0.0)
                    Text("Natural").tag(0.5)
                    Text("Robust").tag(1.0)
                }
                .pickerStyle(.segmented)
                .labelsHidden()

                Text("Creative = expressive, Robust = consistent")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            SettingsSlider(
                title: "Similarity Boost",
                value: $settings.similarityBoost,
                description: "How closely to match the original voice"
            )

            SettingsSlider(
                title: "Style",
                value: $settings.style,
                description: "Emotional exaggeration intensity"
            )

            SpeedSlider(value: $settings.speed)

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

// MARK: - Speed Slider (0.7-1.2 range)

struct SpeedSlider: View {
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Speed")
                    .font(.subheadline)
                Spacer()
                Text(String(format: "%.2f", value))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            Slider(value: $value, in: 0.7 ... 1.2, step: 0.05)
                .controlSize(.small)

            Text("Speech rate (1.0 = normal)")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}
