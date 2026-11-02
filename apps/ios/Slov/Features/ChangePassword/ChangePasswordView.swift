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
                ink: isForced ? L.t("pw.forced_ink") : L.t("pw.change_ink"),
                grey: isForced ? L.t("pw.forced_grey") : L.t("pw.change_grey"),
                role: .title2)
                .padding(.top, Tokens.Space.s5)

            AppField(title: L.t("pw.new"), text: $vm.newPassword, isSecure: true, contentType: .newPassword)
            AppField(title: L.t("pw.confirm"), text: $vm.confirm, isSecure: true, contentType: .newPassword)

            Text(ChangePasswordViewModel.rulesHint)
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textSecondary)

            if let message = vm.errorText {
                Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
            }

            PrimaryButton(title: L.t("pw.update"), style: .brand, isLoading: vm.isLoading, isEnabled: vm.canSubmit) {
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
