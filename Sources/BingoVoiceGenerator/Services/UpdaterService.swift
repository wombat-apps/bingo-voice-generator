import Foundation
#if canImport(Sparkle) && ENABLE_SPARKLE
import Sparkle
#endif

/// Service that manages Sparkle auto-updates.
/// Only active when app is properly signed and ENABLE_SPARKLE is defined.
@MainActor
final class UpdaterService: ObservableObject {
    static let shared = UpdaterService()

    #if canImport(Sparkle) && ENABLE_SPARKLE
    private var updaterController: SPUStandardUpdaterController?
    #endif

    /// Whether the updater is available and properly configured
    @Published private(set) var isAvailable: Bool = false

    /// Whether checking for updates is currently possible
    var canCheckForUpdates: Bool {
        #if canImport(Sparkle) && ENABLE_SPARKLE
        return updaterController?.updater.canCheckForUpdates ?? false
        #else
        return false
        #endif
    }

    private init() {
        #if canImport(Sparkle) && ENABLE_SPARKLE
        guard Self.validateEnvironment() else {
            print("[UpdaterService] Sparkle disabled: environment validation failed")
            return
        }

        updaterController = SPUStandardUpdaterController(
            startingUpdater: false,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )

        updaterController?.updater.automaticallyChecksForUpdates = true
        updaterController?.updater.automaticallyDownloadsUpdates = false

        do {
            try updaterController?.updater.start()
            isAvailable = true
            print("[UpdaterService] Sparkle initialized successfully")
        } catch {
            print("[UpdaterService] Failed to start updater: \(error)")
        }
        #endif
    }

    /// Manually trigger an update check
    func checkForUpdates() {
        #if canImport(Sparkle) && ENABLE_SPARKLE
        guard isAvailable else { return }
        updaterController?.checkForUpdates(nil)
        #endif
    }

    #if canImport(Sparkle) && ENABLE_SPARKLE
    /// Validates that the app is properly configured for Sparkle
    private static func validateEnvironment() -> Bool {
        let bundle = Bundle.main

        guard bundle.bundlePath.hasSuffix(".app") else {
            print("[UpdaterService] Not running from .app bundle")
            return false
        }

        guard bundle.infoDictionary?["SUFeedURL"] != nil else {
            print("[UpdaterService] Missing SUFeedURL in Info.plist")
            return false
        }

        guard bundle.infoDictionary?["SUPublicEDKey"] != nil else {
            print("[UpdaterService] Missing SUPublicEDKey in Info.plist")
            return false
        }

        var staticCode: SecStaticCode?
        guard SecStaticCodeCreateWithPath(
            bundle.bundleURL as CFURL,
            [],
            &staticCode
        ) == errSecSuccess else {
            print("[UpdaterService] Failed to create static code reference")
            return false
        }

        let validationResult = SecStaticCodeCheckValidityWithErrors(
            staticCode!,
            SecCSFlags(rawValue: kSecCSCheckAllArchitectures),
            nil,
            nil
        )

        guard validationResult == errSecSuccess else {
            print("[UpdaterService] App is not properly signed")
            return false
        }

        return true
    }
    #endif
}
