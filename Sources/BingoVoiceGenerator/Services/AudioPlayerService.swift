import AVFoundation
import SwiftUI

@Observable
@MainActor
final class AudioPlayerService: NSObject, Sendable {
    static let shared = AudioPlayerService()

    private(set) var isPlaying = false
    private(set) var currentNumber: Int?

    private var player: AVAudioPlayer?

    override private init() {
        super.init()
    }

    func play(_ audioFile: AudioFile) {
        stop()

        do {
            player = try AVAudioPlayer(contentsOf: audioFile.fileURL)
            player?.delegate = self
            player?.play()
            isPlaying = true
            currentNumber = audioFile.number
        } catch {
            print("Failed to play audio: \(error)")
            isPlaying = false
            currentNumber = nil
        }
    }

    func stop() {
        player?.stop()
        player = nil
        isPlaying = false
        currentNumber = nil
    }
}

extension AudioPlayerService: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.isPlaying = false
            self.currentNumber = nil
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
        Task { @MainActor in
            self.isPlaying = false
            self.currentNumber = nil
        }
    }
}
