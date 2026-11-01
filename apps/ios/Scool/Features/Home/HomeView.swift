import SwiftUI

struct HomeView: View {
    let child: Child
    let children: [Child]
    let onSelect: (Child) -> Void

    @Environment(Session.self) private var session
    @State private var vm = HomeViewModel()
    @State private var showCentre = false
    @State private var showFeedback = false

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: HomeViewModel.greeting(), grey: L.f("home.grey", child.firstName), role: .title1)
                    .padding(.bottom, Tokens.Space.s2)
                promotionCard
                feedbackCard
                todayCard
                feesCard
                resultCard
                noticeCard
            }
            .refreshable { await reload() }
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showCentre) {
                NotificationCentreView(selected: child, children: children)
            }
            .navigationDestination(isPresented: $showFeedback) { FeedbackListView(child: child) }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id, childIds: children.map(\.id), hasLeft: child.hasLeft)
    }

    private var header: some View {
        ChromeGroup {
            HStack {
                ChildSwitcher(selected: child, children: children, onSelect: onSelect)
                Spacer()
                FloatingIconButton(systemName: "bell", label: L.t("notif.bell"), showsDot: vm.hasUnread) {
                    showCentre = true
                }
            }
        }
        .padding(.horizontal, Tokens.Space.s4)
        .padding(.vertical, Tokens.Space.s2)
    }

    // MARK: Cards

    /// Flat card for 14 days after a promotion or completion. Can be dismissed.
    @ViewBuilder
    private var promotionCard: some View {
        if let item = vm.promotion {
            Card {
                HStack(alignment: .top, spacing: Tokens.Space.s3) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 18))
                        .foregroundStyle(Tokens.text)
                        .frame(width: 36, height: 36)
                        .background(Tokens.fill, in: Circle())
                        .accessibilityHidden(true)
                    Text(item.body)
                        .font(.sc(.body, weight: .medium))
                        .foregroundStyle(Tokens.text)
                    Spacer(minLength: 0)
                    Button {
                        vm.dismissPromotion()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.textSecondary)
                            .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(L.t("common.dismiss"))
                }
            }
        }
    }

    /// Only while something is pending.
    @ViewBuilder
    private var feedbackCard: some View {
        if let next = vm.pendingFeedback.first {
            Button { showFeedback = true } label: {
                Card {
                    HStack(spacing: Tokens.Space.s3) {
                        VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                            Text(L.t("home.feedback_title"))
                                .font(.sc(.title3))
                                .foregroundStyle(Tokens.text)
                            Text(L.f("home.feedback_body", child.firstName, IST.date(next.closesOn)))
                                .font(.sc(.callout))
                                .foregroundStyle(Tokens.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.textTertiary)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
        }
    }

    private var todayCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                SectionLabel(L.t("home.today"))
                LoadableView(vm.today, retry: { Task { await reload() } }) { today in
                    Pill(text: today.status.title, tone: today.status.tone)
                    if let at = today.markedAt {
                        Text(L.f("home.marked_at", IST.time(at)))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
    }

    private var feesCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                SectionLabel(L.t("home.fees"))
                LoadableView(vm.invoices, retry: { Task { await reload() } }) { invoices in
                    if let due = HomeViewModel.nextDue(invoices) {
                        Text(Money.format(paise: due.duePaise))
                            .font(.sc(.title2))
                            .foregroundStyle(Tokens.text)
                        Text(L.f("home.due_on", due.periodTitle, IST.date(due.dueOn)))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    } else {
                        Text(L.t("home.all_paid"))
                            .font(.sc(.title3))
                            .foregroundStyle(Tokens.success)
                    }
                }
            }
        }
    }

    private var resultCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                SectionLabel(L.t("home.latest_result"))
                LoadableView(vm.exams, retry: { Task { await reload() } }) { exams in
                    if let exam = HomeViewModel.latestExam(exams) {
                        Text(exam.name)
                            .font(.sc(.title3))
                            .foregroundStyle(Tokens.text)
                        Text("\(Int(exam.percentage.rounded()))%")
                            .font(.sc(.title2))
                            .foregroundStyle(Tokens.accent)
                    } else {
                        Text(L.t("home.no_results"))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
    }

    private var noticeCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                SectionLabel(L.t("home.latest_notice"))
                LoadableView(vm.notices, retry: { Task { await reload() } }) { notices in
                    if let notice = HomeViewModel.latestNotice(notices) {
                        Text(notice.title)
                            .font(.sc(.title3))
                            .foregroundStyle(Tokens.text)
                        Text(notice.body)
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                            .lineLimit(3)
                        Text(IST.day(notice.publishedAt))
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textTertiary)
                    } else {
                        Text(L.t("home.no_notices"))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
    }
}
