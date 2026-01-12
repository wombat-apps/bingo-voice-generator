import SwiftUI

struct WaveformSlider: View {
    let waveformData: WaveformData?
    let currentTime: TimeInterval
    let duration: TimeInterval
    let onSeek: (TimeInterval) -> Void

    @State private var isDragging = false
    @State private var dragProgress: Double = 0

    private var progress: Double {
        guard duration > 0 else { return 0 }
        return isDragging ? dragProgress : (currentTime / duration)
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Waveform visualization
                if let samples = waveformData?.samples {
                    WaveformView(
                        samples: samples,
                        progress: progress,
                        playedColor: .accentColor,
                        unplayedColor: .secondary.opacity(0.3)
                    )
                } else {
                    // Fallback: simple progress bar
                    RoundedRectangle(cornerRadius: 2)
                        .fill(.secondary.opacity(0.2))
                        .overlay(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.accentColor)
                                .frame(width: geometry.size.width * progress)
                        }
                }

                // Invisible drag area
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                isDragging = true
                                let newProgress = max(0, min(1, value.location.x / geometry.size.width))
                                dragProgress = newProgress
                            }
                            .onEnded { value in
                                let finalProgress = max(0, min(1, value.location.x / geometry.size.width))
                                let seekTime = finalProgress * duration
                                onSeek(seekTime)
                                isDragging = false
                            }
                    )

                // Playhead indicator
                Circle()
                    .fill(.white)
                    .shadow(color: .black.opacity(0.2), radius: 2)
                    .frame(width: 10, height: 10)
                    .position(
                        x: geometry.size.width * progress,
                        y: geometry.size.height / 2
                    )
                    .opacity(isDragging ? 1 : 0)
                    .animation(.easeOut(duration: 0.15), value: isDragging)
            }
        }
        .frame(height: 28)
    }
}
