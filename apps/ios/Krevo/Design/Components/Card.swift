import SwiftUI

/// Flat grey card. No shadow, no border.
/// When mounted after a load (`revealContent`), the card shape is static and only its
/// inner content fades in and slides up. Children never animate a second time.
struct Card<Content: View>: View {
    private let content: Content
    private let index: Int

    init(index: Int = 0, @ViewBuilder content: () -> Content) {
        self.index = index
        self.content = content()
    }

    var body: some View {
        content
            .environment(\.revealContent, false)
            .reveal(index: index)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Tokens.Space.s4)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
    }
}
