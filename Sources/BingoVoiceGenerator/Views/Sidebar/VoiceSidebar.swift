import SwiftUI
import AppKit

struct VoiceSidebar: View {
    @Environment(AppState.self) private var appState
    @Environment(VoiceStore.self) private var voiceStore

    @State private var showingAddVoice = false
    @State private var voiceToEdit: Voice?
    @State private var isImporting = false
    @State private var showImportError = false
    @State private var importErrorMessage = ""

    var body: some View {
        List(selection: Binding(
            get: { appState.selectedVoice?.uuid },
            set: { uuid in
                appState.selectedVoice = voiceStore.voices.first { $0.uuid == uuid }
            }
        )) {
            ForEach(Language.allCases) { language in
                let languageVoices = voiceStore.voices(for: language)
                if !languageVoices.isEmpty {
                    Section(header: LanguageSectionHeader(language: language)) {
                        ForEach(languageVoices) { voice in
                            VoiceRow(
                                voice: voice,
                                isFavorite: voiceStore.isFavorite(voice),
                                onToggleFavorite: { voiceStore.toggleFavorite(voice) }
                            )
                            .tag(voice.uuid)
                            .contextMenu {
                                Button("Edit") { voiceToEdit = voice }
                                Button("Delete", role: .destructive) {
                                    deleteVoice(voice)
                                }
                            }
                        }
                        .onDelete { offsets in
                            deleteVoices(at: offsets, in: language)
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            VoiceActionButtons(
                showingAddVoice: $showingAddVoice,
                isImporting: $isImporting,
                onImport: importVoice
            )
        }
        .sheet(isPresented: $showingAddVoice) {
            VoiceFormSheet(mode: .add)
        }
        .sheet(item: $voiceToEdit) { voice in
            VoiceFormSheet(mode: .edit(voice))
        }
        .alert("Import Failed", isPresented: $showImportError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(importErrorMessage)
        }
    }

    private func deleteVoice(_ voice: Voice) {
        let wasSelected = appState.selectedVoice?.uuid == voice.uuid
        voiceStore.deleteVoice(voice)
        if wasSelected {
            appState.selectFirstVoice(from: voiceStore)
        }
    }

    private func deleteVoices(at offsets: IndexSet, in language: Language) {
        let languageVoices = voiceStore.voices(for: language)
        let deletedUUIDs = offsets.map { languageVoices[$0].uuid }
        let wasSelectedDeleted = appState.selectedVoice.map { deletedUUIDs.contains($0.uuid) } ?? false

        voiceStore.deleteVoices(at: offsets, in: language)

        if wasSelectedDeleted {
            appState.selectFirstVoice(from: voiceStore)
        }
    }

    private func importVoice() {
        let openPanel = NSOpenPanel()
        openPanel.allowedContentTypes = [.zip]
        openPanel.allowsMultipleSelection = false
        openPanel.title = "Import Voice"
        openPanel.message = "Select a voice ZIP file to import"

        guard openPanel.runModal() == .OK, let zipURL = openPanel.url else {
            return
        }

        isImporting = true

        Task {
            do {
                let importedVoice = try await ImportService.shared.importVoice(from: zipURL)

                await MainActor.run {
                    voiceStore.addVoice(importedVoice)
                    appState.selectedVoice = importedVoice
                    isImporting = false
                }
            } catch {
                await MainActor.run {
                    importErrorMessage = error.localizedDescription
                    showImportError = true
                    isImporting = false
                }
            }
        }
    }
}

// MARK: - Supporting Views

private struct LanguageSectionHeader: View {
    let language: Language

    var body: some View {
        HStack(spacing: 4) {
            Text(language.flag)
            Text(language.displayName)
        }
    }
}

private struct VoiceRow: View {
    let voice: Voice
    let isFavorite: Bool
    let onToggleFavorite: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(voice.customName)
                    .font(.body)
                // Show original ElevenLabs name if different from custom name
                if voice.elevenLabsName != voice.customName {
                    Text(voice.elevenLabsName)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                Text(voice.elevenLabsId)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                onToggleFavorite()
            } label: {
                Image(systemName: isFavorite ? "star.fill" : "star")
                    .foregroundStyle(isFavorite ? .yellow : .secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 2)
    }
}

private struct VoiceActionButtons: View {
    @Binding var showingAddVoice: Bool
    @Binding var isImporting: Bool
    let onImport: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button {
                showingAddVoice = true
            } label: {
                Label("Add Voice", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)

            Button {
                onImport()
            } label: {
                if isImporting {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Label("Import", systemImage: "square.and.arrow.down")
                }
            }
            .buttonStyle(.bordered)
            .disabled(isImporting)
        }
        .padding()
    }
}
