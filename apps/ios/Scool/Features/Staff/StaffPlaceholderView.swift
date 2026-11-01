import SwiftUI

struct StaffPlaceholderView: View {
    @Environment(Session.self) private var session

    var body: some View {
        ScreenScroll {
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 48, height: 48)
                .foregroundStyle(Tokens.text)
                .padding(.top, Tokens.Space.s7)
                .accessibilityHidden(true)

            TwoToneTitle(ink: "Staff app is coming.", grey: "Use the web app today.", role: .title1)

            PrimaryButton(title: "Sign out", style: .solid) {
                session.signOut()
            }
            .padding(.top, Tokens.Space.s5)
        }
    }
}
