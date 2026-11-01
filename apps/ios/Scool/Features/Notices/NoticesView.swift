import SwiftUI

/// Notices and the school calendar (holidays, exams, events).
struct NoticesView: View {
    @Environment(Session.self) private var session
    @State private var vm = NoticesViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Notices.", grey: "And what is coming up.", role: .title1)

            Picker("Show", selection: $vm.mode) {
                ForEach(NoticesViewModel.Mode.allCases) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            switch vm.mode {
            case .notices:
                noticeList
            case .calendar:
                eventList
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo)
    }

    @ViewBuilder
    private var noticeList: some View {
        LoadableView(vm.notices, retry: { Task { await reload() } }) { list in
            if list.isEmpty {
                EmptyNote(text: "No notices right now.")
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
        LoadableView(vm.events, retry: { Task { await reload() } }) { list in
            if list.isEmpty {
                EmptyNote(text: "Nothing on the calendar.")
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
                        Pill(text: event.kind.title, tone: event.kind == .exam ? .accent : .neutral)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
