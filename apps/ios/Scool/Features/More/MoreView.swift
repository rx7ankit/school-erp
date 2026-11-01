import SwiftUI

struct MoreView: View {
    let child: Child

    enum Route: Hashable {
        case fees, notices, profile, settings
    }

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: "More.", grey: "Everything else.", role: .title1)

                row("Fees", systemImage: "indianrupeesign.circle", route: .fees)
                row("Notices & calendar", systemImage: "megaphone", route: .notices)
                row("\(child.firstName)'s profile", systemImage: "person.crop.circle", route: .profile)
                row("Settings", systemImage: "gearshape", route: .settings)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .fees: FeesView(child: child)
                case .notices: NoticesView()
                case .profile: ProfileView(child: child)
                case .settings: SettingsView()
                }
            }
        }
    }

    private func row(_ title: String, systemImage: String, route: Route) -> some View {
        NavigationLink(value: route) {
            Card {
                HStack(spacing: Tokens.Space.s3) {
                    Image(systemName: systemImage)
                        .font(.system(size: 20))
                        .foregroundStyle(Tokens.text)
                        .frame(width: 28)
                    Text(title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Tokens.textTertiary)
                }
                .frame(minHeight: Tokens.Control.md)
            }
        }
        .buttonStyle(.plain)
    }
}
