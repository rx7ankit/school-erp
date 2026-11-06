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

/// Shows a skeleton placeholder, an error with Retry, or the content (its inner content reveals via `revealContent`).
/// `skeleton` should mirror the real layout and be a single container view.
struct LoadableView<T, Content: View, Skeleton: View>: View {
    let state: Loadable<T>
    let retry: () -> Void
    private let skeleton: () -> Skeleton
    private let content: (T) -> Content

    init(_ state: Loadable<T>,
         retry: @escaping () -> Void,
         @ViewBuilder skeleton: @escaping () -> Skeleton,
         @ViewBuilder content: @escaping (T) -> Content) {
        self.state = state
        self.retry = retry
        self.skeleton = skeleton
        self.content = content
    }

    var body: some View {
        switch state {
        case .idle, .loading:
            skeleton()
                .skeletonAccessibility()
        case .failed(let message):
            VStack(spacing: Tokens.Space.s3) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(Tokens.textTertiary)
                Text(message)
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.textSecondary)
                    .multilineTextAlignment(.center)
                Button(action: retry) {
                    Text(L.t("common.try_again"))
                        .font(.sc(.callout, weight: .semibold))
                        .foregroundStyle(Tokens.text)
                        .padding(.horizontal, Tokens.Space.s5)
                        .frame(minHeight: Tokens.Control.md)
                        .glassCapsule(tint: Color.gray.opacity(0.22), fallback: Tokens.card)
                }
                .buttonStyle(.pressable)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Tokens.Space.s6)
        case .loaded(let value):
            content(value)
                .environment(\.revealContent, true)
        }
    }
}

extension LoadableView where Skeleton == SkeletonList {
    /// Default generic list skeleton, so call sites without a custom skeleton keep compiling.
    init(_ state: Loadable<T>,
         retry: @escaping () -> Void,
         @ViewBuilder content: @escaping (T) -> Content) {
        self.init(state, retry: retry, skeleton: { SkeletonList() }, content: content)
    }
}
