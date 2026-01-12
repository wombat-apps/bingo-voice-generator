import AVFoundation
import SwiftUI

@Observable
@MainActor
final class AudioPlayerService: NSObject, Sendable {
    static let shared = AudioPlayerService()

    private(set) var isPlaying = false
    private(set) var currentNumber: Int?
    private(set) var currentAudioFile: AudioFile?
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval = 0

    // Queue for sequential playback (word → digit)
    private var playbackQueue: [AudioFile] = []

    private var player: AVAudioPlayer?
    private var updateTimer: Timer?

    override private init() {
        super.init()
    }

    private func startTimer() {
        updateTimer?.invalidate()
        updateTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, let player = self.player else { return }
                self.currentTime = player.currentTime
            }
        }
    }

    private func stopTimer() {
        updateTimer?.invalidate()
        updateTimer = nil
    }

    func seek(to time: TimeInterval) {
        let clampedTime = max(0, min(time, duration))
        currentTime = clampedTime
        player?.currentTime = clampedTime
    }

    /// Play a single audio file
    func play(_ audioFile: AudioFile) {
        // Clear queue when playing single file
        playbackQueue = []
        playInternal(audioFile)
    }

    /// Play a sequence of audio files (e.g., word then digit)
    func playSequence(_ audioFiles: [AudioFile]) {
        guard !audioFiles.isEmpty else { return }

        // Set up queue (excluding first item which we'll play immediately)
        playbackQueue = Array(audioFiles.dropFirst())

        // Play first item
        playInternal(audioFiles[0])
    }

    /// Play all parts of a number pair in sequence
    func playPair(_ pair: NumberAudioPair) {
        playSequence(pair.allAudioFiles)
    }

    private func playInternal(_ audioFile: AudioFile) {
        // If same file is already loaded, just resume from current position
        if currentAudioFile == audioFile, player != nil {
            resume()
            return
        }

        // Stop current playback and load new file
        stopTimer()
        player?.stop()
        player = nil

        do {
            player = try AVAudioPlayer(contentsOf: audioFile.fileURL)
            player?.delegate = self
            duration = player?.duration ?? 0
            currentTime = 0
            player?.play()
            isPlaying = true
            currentNumber = audioFile.number
            currentAudioFile = audioFile
            startTimer()
        } catch {
            print("Failed to play audio: \(error)")
            isPlaying = false
            currentNumber = nil
            duration = 0
            currentTime = 0
            playbackQueue = []
        }
    }

    private func playNextInQueue() {
        guard !playbackQueue.isEmpty else {
            // Queue empty, playback complete
            isPlaying = false
            currentTime = duration
            return
        }

        let nextFile = playbackQueue.removeFirst()
        playInternal(nextFile)
    }

    func resume() {
        guard let player else { return }
        player.currentTime = currentTime
        player.play()
        isPlaying = true
        startTimer()
    }

    func stop() {
        stopTimer()
        player?.pause()
        isPlaying = false
        playbackQueue = [] // Clear queue on stop
        // Keep player, currentNumber, currentAudioFile, currentTime, and duration for resume
    }
}

extension AudioPlayerService: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.stopTimer()

            // Check if there are more files in the queue
            if !self.playbackQueue.isEmpty {
                self.playNextInQueue()
            } else {
                self.isPlaying = false
                self.currentTime = self.duration
                // Keep currentNumber, currentAudioFile, and duration for UI display
            }
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
        Task { @MainActor in
            self.stopTimer()
            self.isPlaying = false
            self.playbackQueue = []
            // Keep currentNumber, currentAudioFile, and duration for UI display
        }
    }
}
