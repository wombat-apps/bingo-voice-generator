import SwiftUI

@main
struct BingoVoiceGeneratorApp: App {
    @State private var appState = AppState()
    @State private var generationState = GenerationState()
    @State private var settingsState = SettingsState()
    @State private var voiceStore = VoiceStore()
    @State private var updaterService = UpdaterService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(generationState)
                .environment(settingsState)
                .environment(voiceStore)
                .task {
                    await generationState.loadAPIKey()
                    if appState.selectedVoice == nil && !voiceStore.isEmpty {
                        appState.selectFirstVoice(from: voiceStore)
                    }
                    await appState.refreshAudioFiles()
                }
        }
        .windowResizability(.contentSize)
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updaterService: updaterService)
            }
        }
    }
}

/// Menu item view for "Check for Updates..."
struct CheckForUpdatesView: View {
    var updaterService: UpdaterService

    var body: some View {
        Button("Check for Updates...") {
            updaterService.checkForUpdates()
        }
        .keyboardShortcut("U", modifiers: [.command, .option])
        .disabled(!updaterService.canCheckForUpdates)
    }
}
