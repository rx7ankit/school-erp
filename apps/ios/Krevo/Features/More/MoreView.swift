import SwiftUI

struct MoreView: View {
    let child: Child

    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @State private var path: [Route] = []
    @State private var hasPendingFeedback = false
    @State private var pendingLeaves = 0

    enum Route: Hashable {
        case fees, notices, exams, leave, timetable, feedback, profile, settings
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScreenScroll {
                TwoToneTitle(ink: L.t("more.ink"), grey: L.t("more.grey"), role: .title1)

                row(L.t("more.fees"), systemImage: "indianrupeesign.circle", route: .fees)
                row(L.t("more.notices"), systemImage: "megaphone", route: .notices)
                row(L.t("more.leave"), systemImage: "calendar.badge.minus", route: .leave, badge: pendingLeaves)
                row(L.t("more.timetable"), systemImage: "tablecells", route: .timetable)
                row(L.t("more.feedback"), systemImage: "star.bubble", route: .feedback, showsDot: hasPendingFeedback)
                row(L.f("more.profile", child.firstName), systemImage: "person.crop.circle", route: .profile)
                row(L.t("more.settings"), systemImage: "gearshape", route: .settings)
            }
            .toolbar(.hidden, for: .navigationBar)
            .task { await loadPending() }
            .onAppear { openRequestedRoute() }
            .onChange(of: router.moreRoute) { openRequestedRoute() }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .fees: FeesView(child: child).hidesTabBar()
                case .notices: NoticesView(child: child, initialMode: .notices).hidesTabBar()
                case .exams: NoticesView(child: child, initialMode: .exams).hidesTabBar()
                case .leave: LeaveListView(child: child).hidesTabBar()
                case .timetable: TimetableView(child: child).hidesTabBar()
                case .feedback: FeedbackListView(child: child).hidesTabBar()
                case .profile: ProfileView(child: child).hidesTabBar()
                case .settings: SettingsView().hidesTabBar()
                }
            }
        }
    }

    /// A notification or push asked for one of these screens.
    private func openRequestedRoute() {
        guard let route = router.moreRoute else { return }
        router.moreRoute = nil
        path = [route]
    }

    /// Orange dot on the Feedback row while a request is waiting. None once the child has left.
    private func loadPending() async {
        guard !child.hasLeft else {
            hasPendingFeedback = false
            pendingLeaves = 0
            return
        }
        let leaves = (try? await session.repo.leaveRequests(childId: child.id)) ?? []
        pendingLeaves = leaves.filter { $0.status == .pending }.count
        let list = (try? await session.repo.feedbackRequests(childId: child.id)) ?? []
        hasPendingFeedback = list.contains { !$0.isAnswered }
    }

    private func row(_ title: String, systemImage: String, route: Route, showsDot: Bool = false, badge: Int = 0) -> some View {
        NavigationLink(value: route) {
            Card {
                HStack(spacing: Tokens.Space.s3) {
                    Image(systemName: systemImage)
                        .font(.system(size: 20))
                        .foregroundStyle(Tokens.text)
                        .frame(width: 28)
                    Text(title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                    if badge > 0 {
                        Pill(text: L.f("more.pending_count", String(badge)))
                    }
                    if showsDot {
                        Circle().fill(Tokens.danger).frame(width: 8, height: 8)
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
        .buttonStyle(.pressable)
        .accessibilityLabel(showsDot ? L.f("more.new_request", title) : title)
    }
}
