import Foundation

/// A failure the staff screens can show as is.
struct ApiError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// Thin URLSession client for the Krevo API, shared by the parent and the staff side. Sends the bearer token, refreshes it once on a 401, and turns
/// the API's `{"error": {"message": ...}}` body into a readable error. Nothing here knows about screens.
final class APIClient: @unchecked Sendable {
    static let productionURL = URL(string: "https://api.krevo.tech/api/v1")!

    /// Release builds talk to production. A build can point somewhere else with the `KrevoAPIBase` Info.plist value
    /// (set from the KREVO_API_BASE build setting), for example a server on this Mac while developing.
    static var configuredURL: URL {
        if let text = Bundle.main.object(forInfoDictionaryKey: "KrevoAPIBase") as? String,
           !text.isEmpty, !text.hasPrefix("$("), let url = URL(string: text) { return url }
        return productionURL
    }

    private let baseURL: URL
    private let session: URLSession
    private let lock = NSLock()
    private var access = ""
    private var refresh = ""

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    init(baseURL: URL = APIClient.configuredURL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 25
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
    }

    // MARK: Auth

    func login(email: String, password: String) async throws -> StaffToken {
        struct Body: Encodable { let email: String; let password: String; let device: String }
        let token: StaffToken = try await send("POST", "/auth/login", body: Body(email: email, password: password, device: "ios"), authorised: false)
        setTokens(access: token.accessToken, refresh: token.refreshToken)
        return token
    }

    /// Ends the session on the server (best effort) and forgets the tokens on this phone.
    /// True once a sign-in succeeded and tokens are held.
    var hasSession: Bool { !tokens().access.isEmpty }

    func signOut() {
        guard !tokens().access.isEmpty else { return }
        Task {
            try? await self.sendVoid("POST", "/auth/logout")
            self.setTokens(access: "", refresh: "")
        }
    }

    private func tokens() -> (access: String, refresh: String) {
        lock.lock(); defer { lock.unlock() }
        return (access, refresh)
    }

    private func setTokens(access: String, refresh: String) {
        lock.lock(); defer { lock.unlock() }
        self.access = access
        self.refresh = refresh
    }

    private func renew() async -> Bool {
        let current = tokens().refresh
        guard !current.isEmpty else { return false }
        struct Body: Encodable { let refreshToken: String }
        guard let token: StaffToken = try? await send("POST", "/auth/refresh", body: Body(refreshToken: current), authorised: false) else { return false }
        setTokens(access: token.accessToken, refresh: token.refreshToken)
        return true
    }

    // MARK: Requests

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:]) async throws -> T {
        try await send("GET", path, query: query)
    }

    func send<T: Decodable>(_ method: String, _ path: String, query: [String: String?] = [:],
                            body: (any Encodable)? = nil, authorised: Bool = true) async throws -> T {
        let data = try await raw(method, path, query: query, body: body, authorised: authorised)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw ApiError("The server sent something the app did not understand.")
        }
    }

    func sendVoid(_ method: String, _ path: String, query: [String: String?] = [:],
                  body: (any Encodable)? = nil, authorised: Bool = true) async throws {
        _ = try await raw(method, path, query: query, body: body, authorised: authorised)
    }

    private func raw(_ method: String, _ path: String, query: [String: String?], body: (any Encodable)?,
                     authorised: Bool, retried: Bool = false) async throws -> Data {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        let items = query.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty { components?.queryItems = items.sorted { $0.name < $1.name } }
        guard let url = components?.url else { throw ApiError("Bad address.") }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("krevo-ios", forHTTPHeaderField: "User-Agent")
        if authorised { request.setValue("Bearer " + tokens().access, forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw ApiError("Can't reach the school server. Check your internet connection.")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401, authorised, !retried, await renew() {
            return try await raw(method, path, query: query, body: body, authorised: authorised, retried: true)
        }
        guard (200..<300).contains(status) else {
            throw ApiError(Self.message(from: data, status: status))
        }
        return data
    }

    private static func message(from data: Data, status: Int) -> String {
        struct Wrapper: Decodable { struct Inner: Decodable { let message: String? }; let error: Inner? }
        if let text = try? JSONDecoder().decode(Wrapper.self, from: data).error?.message, !text.isEmpty { return text }
        switch status {
        case 401: return "Your session has ended. Please sign in again."
        case 403: return "You don't have access to this."
        case 404: return "Not found."
        default: return "Something went wrong (\(status)). Please try again."
        }
    }
}

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ value: any Encodable) { self.value = value }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}
