import AVFoundation

@Observable
@MainActor
final class PreviewAudioService: NSObject, Sendable {
    static let shared = PreviewAudioService()

    private(set) var isPlaying = false
    private(set) var isLoading = false
    private(set) var currentVoiceId: String?

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var statusObservation: NSKeyValueObservation?
    private var endObserver: Any?

    override private init() {
        super.init()
    }

    func play(url: URL, voiceId: String) {
        stop()

        currentVoiceId = voiceId
        isLoading = true

        playerItem = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: playerItem)

        statusObservation = playerItem?.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                switch item.status {
                case .readyToPlay:
                    self.isLoading = false
                    self.isPlaying = true
                    self.player?.play()
                case .failed:
                    self.isLoading = false
                    self.isPlaying = false
                    self.currentVoiceId = nil
                default:
                    break
                }
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: playerItem,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handlePlaybackFinished()
            }
        }
    }

    func stop() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        statusObservation?.invalidate()
        statusObservation = nil

        player?.pause()
        player = nil
        playerItem = nil

        isPlaying = false
        isLoading = false
        currentVoiceId = nil
    }

    private func handlePlaybackFinished() {
        isPlaying = false
        currentVoiceId = nil
    }

    func isPreviewingVoice(_ voiceId: String) -> Bool {
        currentVoiceId == voiceId && (isPlaying || isLoading)
    }
}
