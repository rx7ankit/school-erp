import SwiftUI

struct HomeView: View {
    let child: Child
    let children: [Child]
    let onSelect: (Child) -> Void

    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @State private var vm = HomeViewModel()
    @State private var showCentre = false
    @State private var showFeedback = false
    @State private var selectedNotice: NoticeDetail?

    var body: some View {
        NavigationStack {
            ScreenScroll(hero: true) {
                KrevoLockup(markSize: 28)
                TwoToneTitle(ink: HomeViewModel.greeting(), grey: "", role: .title1)
                    .padding(.bottom, Tokens.Space.s2)
                noticeCard
                newMessageBox
                promotionCard
                feedbackCard
                weekCard
                timetableCard
                summaryTiles
            }
            .refreshable { await reload() }
            .safeAreaInset(edge: .top, spacing: 0) { header }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showCentre) {
                NotificationCentreView(selected: child, children: children)
            }
            .navigationDestination(isPresented: $showFeedback) { FeedbackListView(child: child) }
            .sheet(item: $selectedNotice) { NoticeSheet(notice: $0) }
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
                Spacer(minLength: Tokens.Space.s2)
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
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button {
                        vm.dismissPromotion()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Tokens.textSecondary)
                            .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                    }
                    .buttonStyle(.pressable)
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
            .buttonStyle(.pressable)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
        }
    }

    // MARK: Latest notices (top)

    /// The newest school notices as a swipeable row, with small dots showing which one you are on.
    private var noticeCard: some View {
        LoadableView(vm.notices, retry: { Task { await reload() } }, skeleton: {
            SkeletonCard {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    SkeletonLine(width: 120, role: .caption)
                    SkeletonLine(width: 220, role: .title3)
                    SkeletonLine(role: .callout)
                }
            }
        }) { notices in
            let latest = HomeViewModel.latestNotices(notices)
            if !latest.isEmpty {
                NoticeSlider(notices: latest) { selectedNotice = NoticeDetail($0) }
            }
        }
    }

    /// A small box under the notices when a teacher has written and it has not been opened yet.
    @ViewBuilder
    private var newMessageBox: some View {
        if let m = vm.newMessage {
            Button { router.open(.messages, childId: child.id) } label: {
                HStack(spacing: Tokens.Space.s3) {
                    Image(systemName: "bubble.left.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(Tokens.onAccent)
                        .frame(width: 34, height: 34)
                        .background(Tokens.accent, in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(m.count > 1 ? L.f("home.new_messages", String(m.count)) : L.f("home.new_message", m.teacher))
                            .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text)
                        if m.count > 1 { Text(m.teacher).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary) }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                }
                .padding(Tokens.Space.s3)
                .frame(maxWidth: .infinity)
                .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
            }
            .buttonStyle(.pressable)
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    // MARK: This week

    private func dayLabel(_ status: AttendanceStatus) -> (icon: String, color: Color) {
        switch status {
        case .present: return ("checkmark", Tokens.success)
        case .absent: return ("xmark", Tokens.danger)
        case .halfDayFirst, .halfDaySecond: return ("circle.lefthalf.filled", Tokens.warning)
        case .leave: return ("l.circle", Tokens.warning)
        case .holiday: return ("minus", Tokens.textTertiary)
        case .notMarked: return ("", Tokens.textTertiary)
        }
    }

    private var weekCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                HStack {
                    Text(L.t("home.this_week")).font(.sc(.body, weight: .semibold))
                    Spacer()
                    if let today = vm.today.value {
                        Pill(text: today.status.title, tone: today.status.tone)
                    }
                }
                LoadableView(vm.week, retry: { Task { await reload() } }, skeleton: {
                    HStack(spacing: Tokens.Space.s2) {
                        ForEach(0..<6, id: \.self) { _ in SkeletonBlock(height: 64, radius: 18).frame(maxWidth: .infinity) }
                    }
                }) { days in
                    HStack(spacing: 6) {
                        ForEach(days) { day in dayCell(day) }
                    }
                    let present = days.filter { $0.status == .present }.count
                    let absent = days.filter { $0.status == .absent }.count
                    if days.contains(where: { $0.status != .notMarked && $0.status != .holiday }) {
                        Text(L.f("home.week_summary", String(present), String(absent)))
                            .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    } else {
                        Text(L.t("home.week_empty")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
    }

    private func dayCell(_ day: HomeViewModel.WeekDay) -> some View {
        let look = dayLabel(day.status)
        return VStack(spacing: 6) {
            Text(IST.shortWeekday(on: day.on)).font(.sc(.caption, weight: .medium)).foregroundStyle(day.isToday ? Tokens.text : Tokens.textSecondary)
            ZStack {
                Circle().fill(day.isFuture || day.status == .notMarked ? Tokens.fill : look.color.opacity(0.16))
                if !look.icon.isEmpty && !day.isFuture {
                    Image(systemName: look.icon).font(.system(size: 14, weight: .bold)).foregroundStyle(look.color)
                }
            }
            .frame(width: 36, height: 36)
            .overlay(Circle().stroke(day.isToday ? Tokens.text : .clear, lineWidth: 2).padding(-3))
            Text(IST.dayNumber(day.on)).font(.sc(.caption, weight: day.isToday ? .bold : .regular)).foregroundStyle(day.isToday ? Tokens.text : Tokens.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(IST.weekdayName(on: day.on)), \(day.status.title)")
    }

    // MARK: Today's classes

    private var timetableCard: some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                HStack {
                    Text(L.t("home.todays_classes")).font(.sc(.body, weight: .semibold))
                    Spacer()
                    Button { router.open(.timetable, childId: child.id) } label: {
                        Text(L.t("home.see_all")).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.textSecondary)
                    }
                    .buttonStyle(.pressable)
                }
                LoadableView(vm.timetable, retry: { Task { await reload() } }, skeleton: {
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(0..<3, id: \.self) { _ in HStack { SkeletonBlock(width: 54, height: 30, radius: 8); SkeletonLine(width: 160, role: .body) } }
                    }
                }) { table in
                    let periods = HomeViewModel.todaysPeriods(table)
                    if periods.isEmpty {
                        Text(L.t("home.no_school")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    } else {
                        let now = IST.nowHM()
                        VStack(spacing: Tokens.Space.s1) {
                            ForEach(periods, id: \.period.id) { item in
                                periodRow(item.period, item.slot, cover: item.cover, isNow: item.period.start <= now && now < item.period.end)
                            }
                        }
                    }
                }
            }
        }
    }

    private func periodRow(_ p: Period, _ slot: TimetableSlot, cover: String?, isNow: Bool) -> some View {
        HStack(spacing: Tokens.Space.s3) {
            VStack(alignment: .leading, spacing: 0) {
                Text(p.start).font(.sc(.callout, weight: .semibold)).monospacedDigit()
                Text(p.end).font(.sc(.caption)).foregroundStyle(Tokens.textTertiary).monospacedDigit()
            }
            .frame(width: 48, alignment: .leading)
            Rectangle().fill(isNow ? Tokens.accent : Tokens.separator).frame(width: 3).clipShape(Capsule())
            VStack(alignment: .leading, spacing: 2) {
                Text(L.known("subject", slot.subject)).font(.sc(.body, weight: .semibold))
                Text(cover ?? slot.teacher).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            }
            Spacer(minLength: Tokens.Space.s2)
            if cover != nil { Pill(text: L.t("home.cover"), tone: .warning) }
            else if isNow { Pill(text: L.t("home.now"), tone: .accent) }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, Tokens.Space.s2)
        .background(isNow ? Tokens.accentSubtle : .clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: Fees and result

    private var summaryTiles: some View {
        HStack(alignment: .top, spacing: Tokens.Space.s3) {
            feesTile
            resultTile
        }
    }

    private var feesTile: some View {
        Button { router.open(.fees, childId: child.id) } label: {
            tile(icon: "indianrupeesign.circle", label: L.t("home.fees")) {
                LoadableView(vm.invoices, retry: { Task { await reload() } }, skeleton: {
                    VStack(alignment: .leading, spacing: 6) { SkeletonLine(width: 80, role: .title3); SkeletonLine(width: 70, role: .caption) }
                }) { invoices in
                    if let due = HomeViewModel.nextDue(invoices) {
                        Text(Money.format(paise: due.duePaise)).font(.sc(.title3)).foregroundStyle(Tokens.text).minimumScaleFactor(0.7).lineLimit(1)
                        Text(L.f("home.due_on", due.periodTitle, IST.date(due.dueOn))).font(.sc(.caption)).foregroundStyle(due.dueOn < IST.todayOn() ? Tokens.danger : Tokens.textSecondary).lineLimit(2)
                    } else {
                        Text(L.t("home.fees_all_paid")).font(.sc(.title3)).foregroundStyle(Tokens.success)
                    }
                }
            }
        }
        .buttonStyle(.pressable)
    }

    private var resultTile: some View {
        Button { router.open(.results, childId: child.id) } label: {
            tile(icon: "doc.text", label: L.t("home.latest_result")) {
                LoadableView(vm.exams, retry: { Task { await reload() } }, skeleton: {
                    VStack(alignment: .leading, spacing: 6) { SkeletonLine(width: 60, role: .title3); SkeletonLine(width: 90, role: .caption) }
                }) { exams in
                    if let exam = HomeViewModel.latestExam(exams) {
                        Text("\(Int(exam.percentage.rounded()))%").font(.sc(.title3)).foregroundStyle(Tokens.text)
                        Text(exam.name).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary).lineLimit(2)
                    } else {
                        Text(L.t("home.no_results")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    }
                }
            }
        }
        .buttonStyle(.pressable)
    }

    private func tile<Content: View>(icon: String, label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13, weight: .semibold))
                Text(label).font(.sc(.caption, weight: .semibold)).textCase(.uppercase)
            }
            .foregroundStyle(Tokens.textSecondary)
            content()
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .padding(Tokens.Space.s4)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
    }
}

/// Notices side by side: swipe to see the next one, dots below show where you are, tap opens the full notice.
private struct NoticeSlider: View {
    let notices: [Notice]
    let open: (Notice) -> Void

    @State private var page: String?

    private var current: Int { notices.firstIndex { $0.id == page } ?? 0 }

    var body: some View {
        VStack(spacing: Tokens.Space.s2) {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: Tokens.Space.s3) {
                    ForEach(notices) { notice in
                        card(notice)
                            .containerRelativeFrame(.horizontal)
                            .id(notice.id)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $page)
            .scrollClipDisabled()

            if notices.count > 1 {
                HStack(spacing: 6) {
                    ForEach(notices.indices, id: \.self) { i in
                        Capsule()
                            .fill(i == current ? Tokens.solid : Tokens.separator)
                            .frame(width: i == current ? 16 : 6, height: 6)
                    }
                }
                .animation(.smooth(duration: 0.25), value: current)
                .accessibilityHidden(true)
            }
        }
    }

    private func card(_ n: Notice) -> some View {
        let isNew = (IST.daysSince(n.publishedAt) ?? 99) <= 2
        return Button { open(n) } label: {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack(spacing: Tokens.Space.s2) {
                    Image(systemName: "megaphone.fill").font(.system(size: 13, weight: .semibold))
                    Text(L.t("home.latest_notice")).font(.sc(.caption, weight: .semibold)).textCase(.uppercase)
                    if isNew { Pill(text: L.t("home.new"), tone: .success) }
                    Spacer()
                    Text(IST.day(n.publishedAt)).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
                .foregroundStyle(Tokens.accent)
                Text(n.title).font(.sc(.title3)).foregroundStyle(Tokens.text).lineLimit(2).multilineTextAlignment(.leading)
                Text(n.body).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(2).multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: 150, maxHeight: 150, alignment: .topLeading)
            .padding(Tokens.Space.s4)
            .background(Tokens.accentSubtle, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
        }
        .buttonStyle(.pressable)
    }
}
