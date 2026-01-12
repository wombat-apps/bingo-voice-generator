import SwiftUI

struct ModelFormatSection: View {
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        @Bindable var settings = settingsState

        VStack(alignment: .leading, spacing: 16) {
            Text("Model & Output")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 4) {
                Text("Model")
                    .font(.subheadline)

                Picker("Model", selection: $settings.selectedModel) {
                    ForEach(ElevenLabsModel.allCases) { model in
                        Text(model.displayName)
                            .tag(model)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()

                Text(settings.selectedModel.description)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Output Format")
                    .font(.subheadline)

                Picker("Output Format", selection: $settings.outputFormat) {
                    ForEach(OutputFormat.allCases) { format in
                        Text(format.displayName)
                            .tag(format)
                    }
                }
                .pickerStyle(.menu)
                .labelsHidden()
            }
        }
    }
}
