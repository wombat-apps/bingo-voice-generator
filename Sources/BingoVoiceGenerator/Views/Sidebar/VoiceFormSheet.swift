import SwiftUI

struct VoiceFormSheet: View {
    enum Mode: Identifiable {
        case add
        case edit(Voice)

        var id: String {
            switch self {
            case .add: "add"
            case .edit(let voice): "edit-\(voice.uuid)"
            }
        }

        var title: String {
            switch self {
            case .add: "Add Voice"
            case .edit: "Edit Voice"
            }
        }

        var buttonTitle: String {
            switch self {
            case .add: "Add"
            case .edit: "Save"
            }
        }
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(VoiceStore.self) private var voiceStore
    @Environment(AppState.self) private var appState
    @Environment(GenerationState.self) private var generationState

    let mode: Mode

    @State private var elevenLabsName: String = ""
    @State private var customName: String = ""
    @State private var elevenLabsId: String = ""
    @State private var language: Language = .spanish
    @State private var gender: String = "male"
    @State private var showingVoicePicker = false

    private var isValid: Bool {
        !elevenLabsName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !customName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !elevenLabsId.trimmingCharacters(in: .whitespaces).isEmpty
    }

    init(mode: Mode) {
        self.mode = mode
        if case .edit(let voice) = mode {
            _elevenLabsName = State(initialValue: voice.elevenLabsName)
            _customName = State(initialValue: voice.customName)
            _elevenLabsId = State(initialValue: voice.elevenLabsId)
            _language = State(initialValue: voice.language)
            _gender = State(initialValue: voice.gender)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Text(mode.title)
                    .font(.headline)
                Spacer()
                Button(mode.buttonTitle) {
                    save()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid)
            }
            .padding()

            Divider()

            // Form
            Form {
                Section("Voice Details") {
                    TextField("ElevenLabs Voice Name", text: $elevenLabsName)
                        .textFieldStyle(.roundedBorder)
                        .help("Original name from ElevenLabs (e.g., 'Danny')")
                        .onChange(of: elevenLabsName) { oldValue, newValue in
                            // Auto-populate customName if it was empty or matching the old value
                            if customName.isEmpty || customName == oldValue {
                                customName = newValue
                            }
                        }

                    TextField("Custom Name", text: $customName)
                        .textFieldStyle(.roundedBorder)
                        .help("Your name for this voice (e.g., 'Manuel') - used for file organization")

                    TextField("ElevenLabs Voice ID", text: $elevenLabsId)
                        .textFieldStyle(.roundedBorder)
                        .help("Find voice IDs in your ElevenLabs dashboard")

                    Picker("Language", selection: $language) {
                        ForEach(Language.allCases) { lang in
                            Text("\(lang.flag) \(lang.displayName)").tag(lang)
                        }
                    }

                    Picker("Gender", selection: $gender) {
                        Text("♂ Male").tag("male")
                        Text("♀ Female").tag("female")
                    }
                }

                if case .add = mode {
                    Section("Browse ElevenLabs Voices") {
                        Button {
                            showingVoicePicker = true
                        } label: {
                            HStack {
                                Image(systemName: "waveform")
                                Text("Browse Voices...")
                            }
                        }
                        .disabled(!generationState.hasAPIKey)

                        if !generationState.hasAPIKey {
                            Text("Configure your API key to browse voices")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section {
                    Link("Find Voice IDs in ElevenLabs",
                         destination: URL(string: "https://elevenlabs.io/app/voice-library")!)
                        .font(.caption)
                }
            }
            .formStyle(.grouped)
        }
        .frame(width: 400, height: 400)
        .sheet(isPresented: $showingVoicePicker) {
            SharedVoicePickerView(
                language: language,
                apiKey: generationState.apiKey,
                onSelect: { voice in
                    elevenLabsId = voice.voiceId
                    elevenLabsName = voice.name
                    gender = voice.gender ?? "male"
                },
                onDismiss: { showingVoicePicker = false }
            )
        }
    }

    private func save() {
        let trimmedElevenLabsName = elevenLabsName.trimmingCharacters(in: .whitespaces)
        let trimmedCustomName = customName.trimmingCharacters(in: .whitespaces)
        let trimmedId = elevenLabsId.trimmingCharacters(in: .whitespaces)

        switch mode {
        case .add:
            let voice = Voice(
                elevenLabsId: trimmedId,
                elevenLabsName: trimmedElevenLabsName,
                customName: trimmedCustomName,
                language: language,
                gender: gender
            )
            voiceStore.addVoice(voice)
            appState.selectedVoice = voice

        case .edit(let existingVoice):
            let updated = Voice(
                uuid: existingVoice.uuid,
                elevenLabsId: trimmedId,
                elevenLabsName: trimmedElevenLabsName,
                customName: trimmedCustomName,
                language: language,
                gender: gender
            )
            voiceStore.updateVoice(updated)
            if appState.selectedVoice?.uuid == existingVoice.uuid {
                appState.selectedVoice = updated
            }
        }
    }
}
