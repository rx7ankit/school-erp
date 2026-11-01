import SwiftUI

/// Flat grey card. No shadow, no border.
struct Card<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Tokens.Space.s4)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
    }
}
