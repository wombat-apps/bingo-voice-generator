import SwiftUI

struct SharedVoiceRowView: View {
    let voice: SharedVoice
    let isSelected: Bool
    let isPreviewing: Bool
    let isPreviewLoading: Bool
    let onPreviewToggle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(voice.name)
                    .font(.headline)
                    .foregroundStyle(isSelected ? Color.accentColor : .primary)

                HStack(spacing: 6) {
                    if let gender = voice.gender {
                        badge(gender.capitalized, color: gender == "male" ? .blue : .pink)
                    }
                    if let age = voice.age {
                        badge(age, color: .secondary)
                    }
                    if let accent = voice.accent {
                        badge(accent.capitalized, color: .orange)
                    }
                }

                if let useCase = voice.useCase, !useCase.isEmpty {
                    Text(useCase)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            previewButton
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    @ViewBuilder
    private var previewButton: some View {
        Button(action: onPreviewToggle) {
            Group {
                if isPreviewLoading && isPreviewing {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: isPreviewing ? "stop.fill" : "play.fill")
                        .font(.system(size: 12))
                }
            }
            .frame(width: 28, height: 28)
            .background(isPreviewing ? Color.accentColor : Color.secondary.opacity(0.2))
            .foregroundStyle(isPreviewing ? .white : .primary)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .help(isPreviewing ? "Stop preview" : "Play preview")
    }
}
