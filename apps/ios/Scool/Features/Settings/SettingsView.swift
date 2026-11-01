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

    /// Applies instantly: the store is @Observable and every text reads it.
    private var languageBinding: Binding<AppLanguage> {
        Binding(get: { LanguageStore.shared.choice }, set: { LanguageStore.shared.select($0) })
    }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("set.ink"), grey: L.t("set.grey"), role: .title1)

            SectionLabel(L.t("set.language"))
            Picker(L.t("set.language"), selection: languageBinding) {
                ForEach(AppLanguage.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)

            SectionLabel(L.t("set.appearance"))
            Picker(L.t("set.appearance"), selection: $appearance) {
                ForEach(Appearance.allCases) { option in
                    Text(option.title).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)

            SectionLabel(L.t("set.notifications"))
            Card {
                VStack(spacing: Tokens.Space.s2) {
                    ForEach(NotificationCategory.allCases) { category in
                        NotificationToggle(category: category)
                    }
                }
            }

            SectionLabel(L.t("set.account"))
            NavigationLink {
                ChangePasswordView(isForced: false)
            } label: {
                Card {
                    HStack {
                        Text(L.t("set.change_password")).font(.sc(.body)).foregroundStyle(Tokens.text)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.textTertiary)
                    }
                }
            }
            .buttonStyle(.plain)

            PrimaryButton(title: L.t("common.sign_out"), style: .solid) {
                confirmSignOut = true
            }
            .padding(.top, Tokens.Space.s2)

            Text(L.f("set.version", version))
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s3)
        }
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(L.t("set.sign_out_title"), isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button(L.t("common.sign_out"), role: .destructive) { session.signOut() }
            Button(L.t("common.cancel"), role: .cancel) {}
        }
    }
}

/// One on/off switch per notification category. On by default.
private struct NotificationToggle: View {
    let category: NotificationCategory
    @AppStorage private var isOn: Bool

    init(category: NotificationCategory) {
        self.category = category
        _isOn = AppStorage(wrappedValue: true, category.storageKey)
    }

    var body: some View {
        Toggle(category.title, isOn: $isOn)
            .font(.sc(.body))
            .foregroundStyle(Tokens.text)
            .tint(Tokens.accent)
            .frame(minHeight: Tokens.Control.md)
    }
}
