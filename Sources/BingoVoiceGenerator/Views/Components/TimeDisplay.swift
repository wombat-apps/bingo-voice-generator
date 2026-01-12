import SwiftUI

struct TimeDisplay: View {
    let currentTime: TimeInterval
    let duration: TimeInterval

    var body: some View {
        HStack(spacing: 4) {
            Text(formatTime(currentTime))
            Text("/")
                .foregroundStyle(.tertiary)
            Text(formatTime(duration))
        }
        .font(.caption)
        .monospacedDigit()
        .foregroundStyle(.secondary)
    }

    private func formatTime(_ time: TimeInterval) -> String {
        let totalSeconds = Int(time)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        let tenths = Int((time - Double(totalSeconds)) * 10)
        return String(format: "%d:%02d.%d", minutes, seconds, tenths)
    }
}
