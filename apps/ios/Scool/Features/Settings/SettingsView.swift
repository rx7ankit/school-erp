import SwiftUI

struct SettingsView: View {
    @Environment(Session.self) private var session
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system.rawValue
    @State private var confirmSignOut = false

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Settings.", grey: "Make Scool yours.", role: .title1)

            SectionLabel("Appearance")
            Picker("Appearance", selection: $appearance) {
                ForEach(Appearance.allCases) { option in
                    Text(option.title).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)

            SectionLabel("Account")
            NavigationLink {
                ChangePasswordView(isForced: false)
            } label: {
                Card {
                    HStack {
                        Text("Change password").font(.sc(.body)).foregroundStyle(Tokens.text)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.textTertiary)
                    }
                }
            }
            .buttonStyle(.plain)

            PrimaryButton(title: "Sign out", style: .solid) {
                confirmSignOut = true
            }
            .padding(.top, Tokens.Space.s2)

            Text("Scool \(version)")
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s3)
        }
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Sign out of Scool?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { session.signOut() }
            Button("Cancel", role: .cancel) {}
        }
    }
}
