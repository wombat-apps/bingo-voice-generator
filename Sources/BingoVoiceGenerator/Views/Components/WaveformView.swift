import SwiftUI

struct WaveformView: View {
    let samples: [Float]
    let progress: Double
    let playedColor: Color
    let unplayedColor: Color

    var body: some View {
        Canvas { context, size in
            let barCount = samples.count
            guard barCount > 0 else { return }

            let barWidth = size.width / CGFloat(barCount)
            let spacing: CGFloat = 1
            let effectiveBarWidth = max(1, barWidth - spacing)
            let centerY = size.height / 2

            for (index, amplitude) in samples.enumerated() {
                let x = CGFloat(index) * barWidth + spacing / 2
                let barHeight = max(2, CGFloat(amplitude) * size.height * 0.9)

                let rect = CGRect(
                    x: x,
                    y: centerY - barHeight / 2,
                    width: effectiveBarWidth,
                    height: barHeight
                )

                let barProgress = Double(index) / Double(barCount)
                let color = barProgress <= progress ? playedColor : unplayedColor

                context.fill(
                    RoundedRectangle(cornerRadius: effectiveBarWidth / 2)
                        .path(in: rect),
                    with: .color(color)
                )
            }
        }
    }
}
