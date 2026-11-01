import SwiftUI

struct MoreView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var hasPendingFeedback = false

    enum Route: Hashable {
        case fees, notices, feedback, profile, settings
    }

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: "More.", grey: "Everything else.", role: .title1)

                row("Fees", systemImage: "indianrupeesign.circle", route: .fees)
                row("Notices & calendar", systemImage: "megaphone", route: .notices)
                row("Feedback", systemImage: "star.bubble", route: .feedback, showsDot: hasPendingFeedback)
                row("\(child.firstName)'s profile", systemImage: "person.crop.circle", route: .profile)
                row("Settings", systemImage: "gearshape", route: .settings)
            }
            .toolbar(.hidden, for: .navigationBar)
            .task { await loadPending() }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .fees: FeesView(child: child)
                case .notices: NoticesView()
                case .feedback: FeedbackListView(child: child)
                case .profile: ProfileView(child: child)
                case .settings: SettingsView()
                }
            }
        }
    }

    /// Orange dot on the Feedback row while a request is waiting. None once the child has left.
    private func loadPending() async {
        guard !child.hasLeft else {
            hasPendingFeedback = false
            return
        }
        let list = (try? await session.repo.feedbackRequests(childId: child.id)) ?? []
        hasPendingFeedback = list.contains { !$0.isAnswered }
    }

    private func row(_ title: String, systemImage: String, route: Route, showsDot: Bool = false) -> some View {
        NavigationLink(value: route) {
            Card {
                HStack(spacing: Tokens.Space.s3) {
                    Image(systemName: systemImage)
                        .font(.system(size: 20))
                        .foregroundStyle(Tokens.text)
                        .frame(width: 28)
                    Text(title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                    if showsDot {
                        Circle().fill(Tokens.accent).frame(width: 8, height: 8)
                            .accessibilityHidden(true)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Tokens.textTertiary)
                }
                .frame(minHeight: Tokens.Control.md)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(showsDot ? "\(title), new request" : title)
    }
}
