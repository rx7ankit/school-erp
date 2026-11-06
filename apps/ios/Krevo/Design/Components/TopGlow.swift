import SwiftUI

/// An orange glow that pours down from the top edge of the screen and fades to nothing, with a warmer pool in the
/// top-right corner. Decorative only: it takes no taps and is hidden from VoiceOver.
struct TopGlow: View {
    var height: CGFloat

    var body: some View {
        ZStack(alignment: .top) {
            LinearGradient(
                stops: [
                    .init(color: Tokens.accent.opacity(0.62), location: 0),
                    .init(color: Tokens.accent.opacity(0.30), location: 0.34),
                    .init(color: Tokens.accent.opacity(0.10), location: 0.70),
                    .init(color: .clear, location: 1),
                ],
                startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [Color(red: 1.0, green: 0.66, blue: 0.34).opacity(0.55), .clear],
                           center: .topTrailing, startRadius: 0, endRadius: height * 0.95)
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

extension View {
    /// The slim glow shared by every tab, Home included. It multiplies over the page, so text and cards stay crisp.
    func topGlow() -> some View {
        overlay(alignment: .top) {
            TopGlow(height: 120)
                .blendMode(.multiply)
                .ignoresSafeArea(edges: .top)
        }
    }
}
