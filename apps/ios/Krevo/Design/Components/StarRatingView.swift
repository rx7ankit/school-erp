import SwiftUI

/// Five stars, 1 to 5 (0 = not rated). Each star is a 44pt tap target.
/// VoiceOver reads "Rating, 3 of 5 stars" and swipe up/down changes the value.
struct StarRatingView: View {
    @Binding var rating: Int
    var isReadOnly = false

    private let count = 5

    var body: some View {
        if isReadOnly {
            stars
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(L.t("rating.label"))
                .accessibilityValue(L.f("rating.value", String(rating), String(count)))
        } else {
            stars
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(L.t("rating.label"))
                .accessibilityValue(L.f("rating.value", String(rating), String(count)))
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: rating = min(count, rating + 1)
                    case .decrement: rating = max(0, rating - 1)
                    @unknown default: break
                    }
                }
        }
    }

    private var stars: some View {
        HStack(spacing: 0) {
            ForEach(1...count, id: \.self) { index in
                if isReadOnly {
                    star(index)
                } else {
                    Button { rating = index } label: { star(index) }
                        .buttonStyle(.plain)
                }
            }
        }
    }

    private func star(_ index: Int) -> some View {
        Image(systemName: index <= rating ? "star.fill" : "star")
            .font(.system(size: 26))
            .foregroundStyle(index <= rating ? Tokens.accent : Tokens.textTertiary)
            .frame(width: Tokens.Control.md, height: Tokens.Control.md)
            .contentShape(Rectangle())
    }
}
