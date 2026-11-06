import SwiftUI

/// The Krevo mark spinning on its own, then sliding left as the name slides in beside it. Plays once when it appears,
/// the same move the website's intro makes.
struct KrevoLockup: View {
    var markSize: CGFloat = 56
    var color: Color = Tokens.text

    @State private var spin = false
    @State private var slide = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var word: some View {
        Text("Krevo")
            .font(.system(size: markSize * 0.78, weight: .heavy))
            .foregroundStyle(color)
            .fixedSize()
    }

    var body: some View {
        HStack(spacing: markSize * 0.22) {
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: markSize, height: markSize)
                .foregroundStyle(color)
                .rotationEffect(.degrees(spin ? 360 : 0))
            word
                // The name is clipped to nothing at first and opens out to the right, so it reads as sliding out of the mark.
                .mask(alignment: .leading) {
                    Rectangle().frame(width: slide ? 400 : 0)
                }
                .opacity(slide ? 1 : 0)
                .offset(x: slide ? 0 : -markSize * 0.6)
                .frame(width: slide ? nil : 0, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Krevo")
        .onAppear {
            if reduceMotion { spin = false; slide = true; return }
            withAnimation(.easeInOut(duration: 0.9)) { spin = true }
            withAnimation(.spring(response: 0.7, dampingFraction: 0.82).delay(0.8)) { slide = true }
        }
    }
}

/// Full-screen splash shown while a saved sign-in is checked.
struct SplashView: View {
    var body: some View {
        ZStack {
            Tokens.bg.ignoresSafeArea()
            TopGlow(height: 360).frame(maxHeight: .infinity, alignment: .top).ignoresSafeArea()
            KrevoLockup(markSize: 60)
        }
    }
}

/// Shown when a saved sign-in cannot be checked because there is no connection. Nothing is signed out.
struct OfflineView: View {
    @Environment(Session.self) private var session

    var body: some View {
        VStack(spacing: Tokens.Space.s4) {
            Image(systemName: "wifi.slash").font(.system(size: 34, weight: .light)).foregroundStyle(Tokens.textTertiary)
            Text("Can't reach the school server").font(.sc(.title3)).foregroundStyle(Tokens.text)
            Text("You are still signed in. Check your internet connection and try again.")
                .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).multilineTextAlignment(.center)
            PrimaryButton(title: "Try again", style: .solid) { Task { await session.restore() } }
                .frame(maxWidth: 260)
        }
        .padding(Tokens.Space.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
