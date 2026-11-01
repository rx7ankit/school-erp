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

            TwoToneTitle(ink: L.t("staff.ink"), grey: L.t("staff.grey"), role: .title1)

            PrimaryButton(title: L.t("common.sign_out"), style: .solid) {
                session.signOut()
            }
            .padding(.top, Tokens.Space.s5)
        }
    }
}
