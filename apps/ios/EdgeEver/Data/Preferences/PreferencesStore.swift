import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class PreferencesStore {
    private let defaults: UserDefaults

    /// system | zh-CN | en-US — matches Android locale preference.
    var localeCode: String {
        didSet { defaults.set(localeCode, forKey: Keys.locale) }
    }

    var useCompression: Bool {
        didSet { defaults.set(useCompression, forKey: Keys.compression) }
    }

    /// system | light | dark
    var theme: String {
        didSet { defaults.set(theme, forKey: Keys.theme) }
    }

    var listDensity: ListDensity {
        didSet { defaults.set(listDensity.rawValue, forKey: Keys.density) }
    }

    var aiAssistantLastAction: AiAssistantLastActionPreference? {
        didSet { persistAiAssistantLastAction() }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.localeCode = defaults.string(forKey: Keys.locale) ?? "system"
        self.useCompression = defaults.object(forKey: Keys.compression) as? Bool ?? true
        self.theme = defaults.string(forKey: Keys.theme) ?? "system"
        let densityRaw = defaults.string(forKey: Keys.density) ?? ListDensity.preview.rawValue
        // Migrate legacy "comfortable" → preview
        if densityRaw == "comfortable" {
            self.listDensity = .preview
        } else {
            self.listDensity = ListDensity(rawValue: densityRaw) ?? .preview
        }
        self.aiAssistantLastAction = Self.decodeAiAssistantLastAction(defaults.string(forKey: Keys.aiAssistantLastAction))
    }

    var resolvedLocale: Locale {
        switch localeCode {
        case "zh-CN": return Locale(identifier: "zh-Hans")
        case "en-US": return Locale(identifier: "en-US")
        default: return .autoupdatingCurrent
        }
    }

    var isEnglish: Bool {
        if localeCode == "en-US" { return true }
        if localeCode == "zh-CN" { return false }
        return Locale.autoupdatingCurrent.language.languageCode?.identifier == "en"
    }

    var colorScheme: ColorScheme? {
        switch theme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    func t(_ zh: String, en: String) -> String {
        isEnglish ? en : zh
    }

    private func persistAiAssistantLastAction() {
        if let value = aiAssistantLastAction,
           let data = try? JSONEncoder().encode(value),
           let raw = String(data: data, encoding: .utf8) {
            defaults.set(raw, forKey: Keys.aiAssistantLastAction)
        } else {
            defaults.removeObject(forKey: Keys.aiAssistantLastAction)
        }
    }

    private static func decodeAiAssistantLastAction(_ raw: String?) -> AiAssistantLastActionPreference? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(AiAssistantLastActionPreference.self, from: data)
    }

    private enum Keys {
        static let locale = "edgeever.ios.locale"
        static let compression = "edgeever.ios.imageCompression"
        static let theme = "edgeever.ios.theme"
        static let density = "edgeever.ios.listDensity"
        static let aiAssistantLastAction = "edgeever.aiAssistant.lastAction"
    }
}
