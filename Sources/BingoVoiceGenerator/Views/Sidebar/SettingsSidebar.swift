import SwiftUI

struct SettingsSidebar: View {
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SidebarHeader()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    APIKeySection()

                    Divider()

                    VoiceSettingsSection()

                    Divider()

                    ModelFormatSection()

                    Divider()

                    Button("Reset to Defaults") {
                        settingsState.resetToDefaults()
                    }
                    .buttonStyle(.link)
                    .foregroundStyle(.secondary)
                }
                .padding()
            }
        }
        .frame(width: 280)
        .background(.regularMaterial)
    }
}

// MARK: - Sidebar Header

private struct SidebarHeader: View {
    @Environment(SettingsState.self) private var settingsState

    var body: some View {
        HStack {
            Label("ElevenLabs Settings", systemImage: "slider.horizontal.3")
                .font(.headline)

            Spacer()
        }
        .padding()
    }
}
