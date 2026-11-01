import SwiftUI

struct HomeView: View {
    let child: Child
    let children: [Child]
    let onSelect: (Child) -> Void

    @Environment(Session.self) private var session
    @State private var vm = HomeViewModel()
    @State private var showNotices = false

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: HomeViewModel.greeting(), grey: "\(child.firstName)'s day at a glance.", role: .title1)
                    .padding(.bottom, Tokens.Space.s2)
                todayCard
                feesCard
                resultCard
                noticeCard
            }
            .refreshable { await reload() }
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showNotices) { NoticesView() }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private var header: some View {
        ChromeGroup {
            HStack {
                ChildSwitcher(selected: child, children: children, onSelect: onSelect)
                Spacer()
                FloatingIconButton(systemName: "bell", label: "Notices", showsDot: true) {
                    showNotices = true
                }
            }
        }
        .padding(.horizontal, Tokens.Space.s4)
        .padding(.vertical, Tokens.Space.s2)
    }

    // MARK: Cards

    private var todayCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                SectionLabel("Today")
                LoadableView(vm.today, retry: { Task { await reload() } }) { today in
                    Pill(text: today.status.title, tone: today.status.tone)
                    if let at = today.markedAt {
                        Text("Marked at \(IST.time(at)) IST")
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
                SectionLabel("Fees")
                LoadableView(vm.invoices, retry: { Task { await reload() } }) { invoices in
                    if let due = HomeViewModel.nextDue(invoices) {
                        Text(Money.format(paise: due.duePaise))
                            .font(.sc(.title2))
                            .foregroundStyle(Tokens.text)
                        Text("\(due.period) due on \(IST.date(due.dueOn))")
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    } else {
                        Text("All paid")
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
                SectionLabel("Latest result")
                LoadableView(vm.exams, retry: { Task { await reload() } }) { exams in
                    if let exam = HomeViewModel.latestExam(exams) {
                        Text(exam.name)
                            .font(.sc(.title3))
                            .foregroundStyle(Tokens.text)
                        Text("\(Int(exam.percentage.rounded()))%")
                            .font(.sc(.title2))
                            .foregroundStyle(Tokens.accent)
                    } else {
                        Text("No results published yet.")
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
                SectionLabel("Latest notice")
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
                        Text("No notices.")
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
    }
}
