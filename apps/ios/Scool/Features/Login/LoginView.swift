import SwiftUI

struct LoginView: View {
    @Environment(Session.self) private var session
    @State private var vm = LoginViewModel()

    var body: some View {
        ScreenScroll {
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 48, height: 48)
                .foregroundStyle(Tokens.text)
                .padding(.top, Tokens.Space.s6)
                .accessibilityLabel("Scool")

            TwoToneTitle(ink: "Welcome back.", grey: "Sign in to continue.", role: .title1)
                .padding(.bottom, Tokens.Space.s3)

            AppField(title: "Email", text: $vm.email, keyboard: .emailAddress, contentType: .username)
            AppField(title: "Password", text: $vm.password, isSecure: true, contentType: .password)

            if let message = vm.errorText {
                Text(message)
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.danger)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            PrimaryButton(title: "Sign in", style: .solid, isLoading: vm.isLoading, isEnabled: vm.canSubmit) {
                Task { await vm.submit(session: session) }
            }
            .padding(.top, Tokens.Space.s2)

            Text("Your login is created by the school. Ask the school office if you have not received it.")
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}
