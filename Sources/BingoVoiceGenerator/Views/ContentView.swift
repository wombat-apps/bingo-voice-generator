import SwiftUI
import AppKit

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState
    @Environment(SettingsState.self) private var settingsState
    @Environment(VoiceStore.self) private var voiceStore

    @State private var isExporting = false
    @State private var showExportSuccess = false
    @State private var showExportError = false
    @State private var exportErrorMessage = ""

    var body: some View {
        NavigationSplitView {
            VoiceSidebar()
                .navigationSplitViewColumnWidth(min: 200, ideal: 250, max: 300)
        } detail: {
            HStack(spacing: 0) {
                if voiceStore.isEmpty {
                    EmptyStateView()
                } else if appState.selectedVoice == nil {
                    Text("Select a voice from the sidebar")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    VoiceDetailView()
                }

                if settingsState.isSidebarVisible && !voiceStore.isEmpty && appState.selectedVoice != nil {
                    Divider()
                    SettingsSidebar()
                        .transition(.move(edge: .trailing))
                }
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if let voice = appState.selectedVoice {
                            Task { await exportVoice(voice) }
                        }
                    } label: {
                        if isExporting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                    }
                    .help("Export voice")
                    .disabled(isExporting || voiceStore.isEmpty || appState.selectedVoice == nil)
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            settingsState.isSidebarVisible.toggle()
                        }
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                    }
                    .help(settingsState.isSidebarVisible ? "Hide settings" : "Show settings")
                    .disabled(voiceStore.isEmpty || appState.selectedVoice == nil)
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .alert(
            "Error",
            isPresented: Binding(
                get: { generationState.showingError },
                set: { generationState.showingError = $0 }
            )
        ) {
            Button("OK") { generationState.showingError = false }
        } message: {
            Text(generationState.lastError?.localizedDescription ?? "Unknown error")
        }
        .alert("Export Successful", isPresented: $showExportSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Voice exported successfully.")
        }
        .alert("Export Failed", isPresented: $showExportError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportErrorMessage)
        }
        .onAppear {
            if appState.selectedVoice == nil && !voiceStore.isEmpty {
                appState.selectFirstVoice(from: voiceStore)
            }
        }
    }

    private func exportVoice(_ voice: Voice) async {
        isExporting = true
        defer { isExporting = false }

        do {
            let tempZipURL = try await ExportService.shared.exportVoice(
                voice: voice,
                language: voice.language
            )

            // Show save panel on main thread
            await MainActor.run {
                let savePanel = NSSavePanel()
                savePanel.allowedContentTypes = [.zip]
                savePanel.nameFieldStringValue = "\(voice.fileSystemName).zip"
                savePanel.title = "Export Voice"
                savePanel.message = "Choose where to save the exported voice"

                if savePanel.runModal() == .OK, let destURL = savePanel.url {
                    do {
                        // Remove existing file if present
                        try? FileManager.default.removeItem(at: destURL)
                        try FileManager.default.copyItem(at: tempZipURL, to: destURL)
                        showExportSuccess = true
                    } catch {
                        exportErrorMessage = error.localizedDescription
                        showExportError = true
                    }
                }

                // Clean up temp file
                Task {
                    await ExportService.shared.cleanupTempFile(at: tempZipURL)
                }
            }
        } catch {
            await MainActor.run {
                exportErrorMessage = error.localizedDescription
                showExportError = true
            }
        }
    }
}
