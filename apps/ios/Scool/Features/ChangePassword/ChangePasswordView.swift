import SwiftUI

/// Forced on first login (isForced) or pushed from Settings.
struct ChangePasswordView: View {
    let isForced: Bool

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var vm = ChangePasswordViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(
                ink: isForced ? "Set a new password." : "Change password.",
                grey: isForced ? "Your temporary password must be replaced." : "Choose something only you know.",
                role: .title2)
                .padding(.top, Tokens.Space.s5)

            AppField(title: "New password", text: $vm.newPassword, isSecure: true, contentType: .newPassword)
            AppField(title: "Confirm password", text: $vm.confirm, isSecure: true, contentType: .newPassword)

            Text(ChangePasswordViewModel.rulesHint)
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textSecondary)

            if let message = vm.errorText {
                Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
            }

            PrimaryButton(title: "Update password", style: .brand, isLoading: vm.isLoading, isEnabled: vm.canSubmit) {
                Task {
                    let ok = await vm.submit(session: session)
                    if ok && !isForced { dismiss() }
                }
            }
            .padding(.top, Tokens.Space.s2)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
    }
}
