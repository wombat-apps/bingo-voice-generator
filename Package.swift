// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "BingoVoiceGenerator",
    platforms: [
        .macOS(.v14),
    ],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.0"),
    ],
    targets: [
        .executableTarget(
            name: "BingoVoiceGenerator",
            dependencies: [
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/BingoVoiceGenerator",
            resources: [
                .copy("Resources/ffmpeg"),
            ],
            swiftSettings: [
                .swiftLanguageMode(.v6),
            ]
        )
    ]
)
