import Foundation

struct WaveformData: Sendable, Codable, Equatable {
    let samples: [Float]

    var sampleCount: Int { samples.count }
}
