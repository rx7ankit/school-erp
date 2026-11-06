import Foundation
import Security

/// Keeps the sign-in on this phone in the Keychain, so closing the app, restarting the phone or installing a new
/// build keeps you signed in. Only signing out (or the school ending the session) clears it.
enum TokenStore {
    private static let service = "tech.krevo.app.session"
    private static let account = "tokens"

    private struct Pair: Codable { let access: String; let refresh: String }

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    static func load() -> (access: String, refresh: String)? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
              let pair = try? JSONDecoder().decode(Pair.self, from: data), !pair.refresh.isEmpty else { return nil }
        return (pair.access, pair.refresh)
    }

    static func save(access: String, refresh: String) {
        guard !refresh.isEmpty, let data = try? JSONEncoder().encode(Pair(access: access, refresh: refresh)) else { return clear() }
        let update = [kSecValueData as String: data]
        if SecItemUpdate(query as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            var add = query
            add[kSecValueData as String] = data
            // Readable after the first unlock, so a push or background refresh works with the phone locked.
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}
