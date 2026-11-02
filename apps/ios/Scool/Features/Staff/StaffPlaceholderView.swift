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

            // The staff app stays English-only.
            TwoToneTitle(ink: L.t("staff.ink", in: .en), grey: L.t("staff.grey", in: .en), role: .title1)

            PrimaryButton(title: L.t("common.sign_out", in: .en), style: .solid) {
                session.signOut()
            }
            .padding(.top, Tokens.Space.s5)
        }
    }
}
