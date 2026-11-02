import SwiftUI

enum Loadable<T> {
    case idle
    case loading
    case loaded(T)
    case failed(String)

    var value: T? {
        if case .loaded(let v) = self { return v }
        return nil
    }

    /// Run `work` and capture the result as a Loadable.
    static func capture(_ work: () async throws -> T) async -> Loadable<T> {
        do {
            return .loaded(try await work())
        } catch {
            return .failed(error.localizedDescription)
        }
    }
}

/// Shows a spinner, an error with Retry, or the content.
struct LoadableView<T, Content: View>: View {
    let state: Loadable<T>
    let retry: () -> Void
    private let content: (T) -> Content

    init(_ state: Loadable<T>, retry: @escaping () -> Void, @ViewBuilder content: @escaping (T) -> Content) {
        self.state = state
        self.retry = retry
        self.content = content
    }

    var body: some View {
        switch state {
        case .idle, .loading:
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.vertical, Tokens.Space.s7)
        case .failed(let message):
            VStack(spacing: Tokens.Space.s3) {
                Text(message)
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.danger)
                    .multilineTextAlignment(.center)
                Button(L.t("common.try_again"), action: retry)
                    .font(.sc(.callout, weight: .semibold))
                    .foregroundStyle(Tokens.accent)
                    .frame(minHeight: Tokens.Control.md)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Tokens.Space.s6)
        case .loaded(let value):
            content(value)
        }
    }
}
