import SwiftUI

struct SharedVoicePickerView: View {
    let language: Language
    let apiKey: String
    let onSelect: (SharedVoice) -> Void
    let onDismiss: () -> Void

    @State private var pickerState = SharedVoicePickerState()
    @State private var selectedVoice: SharedVoice?
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            filterBar
            Divider()
            voiceList
            Divider()
            footer
        }
        .frame(width: 500, height: 500)
        .task {
            await pickerState.loadVoices(for: language, apiKey: apiKey)
        }
        .onDisappear {
            pickerState.stopPreview()
        }
    }

    @ViewBuilder
    private var header: some View {
        HStack {
            Text("Browse ElevenLabs Voices")
                .font(.headline)
            Spacer()
            Text("\(language.flag) \(language.displayName)")
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    @ViewBuilder
    private var filterBar: some View {
        HStack(spacing: 12) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search voices...", text: $pickerState.searchText)
                    .textFieldStyle(.plain)
                if !pickerState.searchText.isEmpty {
                    Button {
                        pickerState.searchText = ""
                        triggerSearch()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(Color.secondary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))

            Picker("Gender", selection: $pickerState.selectedGender) {
                ForEach(VoiceGender.allCases) { gender in
                    Text(gender.displayName).tag(gender)
                }
            }
            .frame(width: 100)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .onChange(of: pickerState.searchText) { _, _ in
            triggerSearchDebounced()
        }
        .onChange(of: pickerState.selectedGender) { _, _ in
            triggerSearch()
        }
    }

    @ViewBuilder
    private var voiceList: some View {
        Group {
            if pickerState.isLoading && pickerState.voices.isEmpty {
                loadingView
            } else if let error = pickerState.loadError {
                errorView(error)
            } else if pickerState.voices.isEmpty {
                emptyView
            } else {
                List(pickerState.voices, selection: $selectedVoice) { voice in
                    SharedVoiceRowView(
                        voice: voice,
                        isSelected: selectedVoice?.voiceId == voice.voiceId,
                        isPreviewing: pickerState.isPreviewingVoice(voice.voiceId),
                        isPreviewLoading: pickerState.isPreviewLoading,
                        onPreviewToggle: { pickerState.playPreview(for: voice) }
                    )
                    .tag(voice)
                    .listRowInsets(EdgeInsets(top: 4, leading: 12, bottom: 4, trailing: 12))
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading voices...")
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func errorView(_ error: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text("Failed to load voices")
                .font(.headline)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                triggerSearch()
            }
        }
        .padding()
    }

    @ViewBuilder
    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("No voices found")
                .font(.headline)
            Text("Try adjusting your search or filters")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var footer: some View {
        HStack {
            if pickerState.isLoading && !pickerState.voices.isEmpty {
                ProgressView()
                    .scaleEffect(0.8)
            }
            Spacer()
            Button("Cancel") {
                onDismiss()
            }
            .keyboardShortcut(.cancelAction)

            Button("Select") {
                if let voice = selectedVoice {
                    onSelect(voice)
                    onDismiss()
                }
            }
            .keyboardShortcut(.defaultAction)
            .disabled(selectedVoice == nil)
        }
        .padding()
    }

    private func triggerSearchDebounced() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await pickerState.loadVoices(for: language, apiKey: apiKey)
        }
    }

    private func triggerSearch() {
        searchTask?.cancel()
        searchTask = Task {
            await pickerState.loadVoices(for: language, apiKey: apiKey)
        }
    }
}
