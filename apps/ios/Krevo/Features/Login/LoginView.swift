import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var vm = LoginViewModel()

    var body: some View {
        ScreenScroll(hero: true) {
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 48, height: 48)
                .foregroundStyle(Tokens.text)
                .padding(.top, Tokens.Space.s3)
                .accessibilityLabel(L.t("app.name"))

            TwoToneTitle(ink: L.t("login.ink"), grey: L.t("login.grey"), role: .title1)
                .padding(.bottom, Tokens.Space.s3)

            AppField(title: L.t("login.email"), text: $vm.email, keyboard: .emailAddress, contentType: .username, submitLabel: .next)
            AppField(title: L.t("login.password"), text: $vm.password, isSecure: true, contentType: .password, submitLabel: .go, onSubmit: { Task { await vm.submit(session: session) } })

            if let message = vm.errorText {
                Text(message)
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.danger)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            PrimaryButton(title: L.t("login.sign_in"), style: .solid, isLoading: vm.isLoading) {
                Task { await vm.submit(session: session) }
            }
            .padding(.top, Tokens.Space.s2)

            Text(L.t("login.help"))
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}
