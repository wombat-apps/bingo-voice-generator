import SwiftUI

struct APIKeySection: View {
    @Environment(GenerationState.self) private var generationState
    @State private var apiKeyInput: String = ""
    @State private var showKey: Bool = false
    @State private var isSaved: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("API Key")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            HStack(spacing: 8) {
                Group {
                    if showKey {
                        TextField("ElevenLabs API Key", text: $apiKeyInput)
                    } else {
                        SecureField("ElevenLabs API Key", text: $apiKeyInput)
                    }
                }
                .textFieldStyle(.roundedBorder)

                Button {
                    showKey.toggle()
                } label: {
                    Image(systemName: showKey ? "eye.slash" : "eye")
                }
                .buttonStyle(.borderless)
                .help(showKey ? "Hide API key" : "Show API key")
            }

            HStack {
                Button("Save") {
                    saveAPIKey()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(apiKeyInput.isEmpty)

                if isSaved {
                    Label("Saved", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                }

                Spacer()

                if generationState.hasAPIKey {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundStyle(.green)
                        .help("API key configured")
                }
            }

            // Subscription info
            if let subscription = generationState.subscription {
                SubscriptionInfoView(subscription: subscription)
            }
        }
        .onAppear {
            apiKeyInput = generationState.apiKey
        }
    }

    private func saveAPIKey() {
        Task {
            await generationState.saveAPIKey(apiKeyInput)
            isSaved = true
            try? await Task.sleep(for: .seconds(2))
            isSaved = false
        }
    }
}

// MARK: - Subscription Info View

private struct SubscriptionInfoView: View {
    let subscription: SubscriptionInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()

            // Tier badge
            HStack {
                Text("Plan:")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(subscription.tier.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(tierColor.opacity(0.2))
                    .foregroundStyle(tierColor)
                    .clipShape(Capsule())
            }

            // Character usage
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Characters")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(formatNumber(subscription.characterCount)) / \(formatNumber(subscription.characterLimit))")
                        .font(.caption)
                        .fontWeight(.medium)
                }

                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: 4)
                            .fill(usageColor)
                            .frame(width: geometry.size.width * subscription.usagePercentage, height: 6)
                    }
                }
                .frame(height: 6)

                // Remaining
                Text("\(formatNumber(subscription.remainingCharacters)) remaining")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Next reset
            if let resetDate = subscription.nextResetDate {
                HStack {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption2)
                    Text("Resets \(resetDate, style: .relative)")
                        .font(.caption2)
                }
                .foregroundStyle(.secondary)
            }
        }
        .padding(.top, 4)
    }

    private var tierColor: Color {
        switch subscription.tier.lowercased() {
        case "free": return .gray
        case "starter": return .blue
        case "creator": return .purple
        case "pro", "professional": return .orange
        case "scale", "enterprise": return .red
        default: return .blue
        }
    }

    private var usageColor: Color {
        let percentage = subscription.usagePercentage
        if percentage >= 0.9 { return .red }
        if percentage >= 0.7 { return .orange }
        return .green
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
}
