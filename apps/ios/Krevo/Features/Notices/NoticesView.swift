import SwiftUI

/// Notices and the school calendar (holidays, exams, events).
struct NoticesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm: NoticesViewModel

    init(child: Child, initialMode: NoticesViewModel.Mode = .notices) {
        self.child = child
        _vm = State(initialValue: NoticesViewModel(mode: initialMode))
    }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("notices.ink"), grey: L.t("notices.grey"), role: .title1)

            Picker(L.t("notices.picker"), selection: $vm.mode) {
                ForEach(NoticesViewModel.Mode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            switch vm.mode {
            case .notices:
                noticeList
            case .calendar:
                eventList
            case .exams:
                examList
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    @ViewBuilder
    private var noticeList: some View {
        LoadableView(vm.notices, retry: { Task { await reload() } }, skeleton: {
            VStack(spacing: Tokens.Space.s4) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonCard {
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                            SkeletonLine(width: 190, role: .body)
                            SkeletonLine(role: .callout)
                            SkeletonLine(width: 220, role: .callout)
                            SkeletonLine(width: 90, role: .caption)
                        }
                    }
                }
            }
        }) { list in
            if list.isEmpty {
                EmptyNote(text: L.t("notices.empty"))
            }
            ForEach(list) { notice in
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        Text(notice.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                        Text(notice.body).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                        Text(IST.day(notice.publishedAt))
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textTertiary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    @ViewBuilder
    private var eventList: some View {
        LoadableView(vm.events, retry: { Task { await reload() } }, skeleton: {
            VStack(spacing: Tokens.Space.s4) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonCard {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonLine(width: 160, role: .body)
                                SkeletonLine(width: 120, role: .callout)
                            }
                            Spacer()
                            SkeletonPill(width: 70)
                        }
                    }
                }
            }
        }) { list in
            if list.isEmpty {
                EmptyNote(text: L.t("notices.empty_calendar"))
            }
            ForEach(list) { event in
                Card {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                            Text(IST.dateRange(from: event.fromOn, to: event.toOn))
                                .font(.sc(.callout))
                                .foregroundStyle(Tokens.textSecondary)
                        }
                        Spacer()
                        Pill(text: event.kind.title, tone: .neutral)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    /// Exam name, date range and the per-subject date sheet, for this child's class.
    @ViewBuilder
    private var examList: some View {
        LoadableView(vm.schedules, retry: { Task { await reload() } }, skeleton: {
            VStack(spacing: Tokens.Space.s4) {
                ForEach(0..<2, id: \.self) { _ in
                    SkeletonCard {
                        VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonLine(width: 170, role: .body)
                                SkeletonLine(width: 130, role: .callout)
                                SkeletonLine(width: 80, role: .caption)
                            }
                            ForEach(0..<3, id: \.self) { _ in
                                Separator()
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        SkeletonLine(width: 90, role: .callout)
                                        SkeletonLine(width: 130, role: .caption)
                                    }
                                    Spacer()
                                    SkeletonLine(width: 80, role: .body)
                                }
                            }
                        }
                    }
                }
            }
        }) { list in
            if list.isEmpty {
                EmptyNote(text: L.t("notices.empty_exams"))
            }
            ForEach(list) { exam in
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exam.name).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                            Text(IST.dateRange(from: exam.fromOn, to: exam.toOn))
                                .font(.sc(.callout))
                                .foregroundStyle(Tokens.textSecondary)
                            Text(L.f("notices.class_fmt", exam.classLabel))
                                .font(.sc(.caption))
                                .foregroundStyle(Tokens.textTertiary)
                        }
                        ForEach(exam.papers) { paper in
                            Separator()
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(IST.day(paper.startAt)).font(.sc(.callout, weight: .medium)).foregroundStyle(Tokens.text)
                                    Text("\(IST.weekday(paper.startAt)), \(IST.time(paper.startAt)) IST")
                                        .font(.sc(.caption))
                                        .foregroundStyle(Tokens.textSecondary)
                                }
                                Spacer(minLength: Tokens.Space.s3)
                                Text(L.known("subject", paper.subject)).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
        }
    }
}
