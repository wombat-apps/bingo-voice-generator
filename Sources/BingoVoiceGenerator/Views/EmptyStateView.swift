import SwiftUI

struct EmptyStateView: View {
    @State private var showingAddVoice = false

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "waveform.badge.plus")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)

            Text("No Voices Yet")
                .font(.title)
                .fontWeight(.semibold)

            Text("Add your first voice to start generating bingo audio files.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)

            Button {
                showingAddVoice = true
            } label: {
                Label("Add Your First Voice", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sheet(isPresented: $showingAddVoice) {
            VoiceFormSheet(mode: .add)
        }
    }
}
