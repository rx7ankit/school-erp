import SwiftUI

/// Hashable marker for the Updates screen in the navigation stack.
struct UpdatesRoute: Hashable {}

struct MessagesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = MessagesViewModel()
    @State private var selected: NoticeDetail?

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.t("msgs.ink"), grey: L.f("msgs.grey", child.firstName), role: .title1)

                if child.hasLeft {
                    Card {
                        Text(L.f("msgs.left", child.firstName))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }

                noticesSection

                LoadableView(vm.threads, retry: { Task { await reload() } }, skeleton: {
                    VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                        SectionLabel(L.t("msgs.teachers"))
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonCard {
                                HStack(spacing: Tokens.Space.s3) {
                                    SkeletonCircle(size: 44)
                                    VStack(alignment: .leading, spacing: 4) {
                                        SkeletonLine(width: 140, role: .body)
                                        SkeletonPill(width: 80)
                                        SkeletonLine(width: 180, role: .callout)
                                    }
                                    Spacer()
                                    SkeletonLine(width: 40, role: .caption)
                                }
                            }
                        }
                    }
                }) { list in
                    let current = MessagesViewModel.current(list)
                    let previous = MessagesViewModel.previous(list)
                    SectionLabel(L.t("msgs.teachers"))
                    if current.isEmpty {
                        EmptyNote(text: L.t("msgs.empty_teachers"))
                    }
                    ForEach(current) { thread in
                        NavigationLink(value: thread) {
                            ThreadRow(thread: thread)
                        }
                        .buttonStyle(.pressable)
                    }
                    if !previous.isEmpty {
                        SectionLabel(L.t("msgs.previous"))
                        ForEach(previous) { thread in
                            NavigationLink(value: thread) {
                                ThreadRow(thread: thread)
                            }
                            .buttonStyle(.pressable)
                        }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selected) { NoticeSheet(notice: $0) }
            .navigationDestination(for: UpdatesRoute.self) { _ in
                UpdatesView(child: child)
            }
            .navigationDestination(for: TeacherThread.self) { thread in
                ChatView(thread: thread, child: child)
            }
        }
        .task { await reload() }
        // Opening the tab counts as seeing the notices: clear the unread markers when leaving it.
        .onDisappear { let repo = session.repo; let id = child.id; Task { try? await repo.markUpdatesRead(childId: id) } }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    // MARK: Notices (pinned at the top)

    /// The latest notices as compact cards. Tap one for the full text in a sheet.
    @ViewBuilder
    private var noticesSection: some View {
        LoadableView(vm.updates, retry: { Task { await reload() } }, skeleton: {
            VStack(spacing: Tokens.Space.s3) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonCard { VStack(alignment: .leading, spacing: 6) { SkeletonLine(width: 180, role: .body); SkeletonLine(role: .callout); SkeletonLine(width: 110, role: .caption) } }
                }
            }
        }) { list in
            let items = list.sorted { $0.at > $1.at }.prefix(20)
            SectionLabel(L.t("msgs.notices"))
            if items.isEmpty {
                EmptyNote(text: L.t("msgs.no_updates"), systemImage: "megaphone")
            }
            ForEach(Array(items)) { item in
                Button { selected = NoticeDetail(item) } label: { NoticeRow(item: item) }
                    .buttonStyle(.pressable)
            }
        }
    }
}

/// A notice in the list: headline, a line of the text, and who sent it when.
private struct NoticeRow: View {
    let item: Update

    var body: some View {
        let detail = NoticeDetail(item)
        Card {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: Tokens.Space.s2) {
                    if !item.isRead { Circle().fill(Tokens.danger).frame(width: 8, height: 8).accessibilityHidden(true) }
                    Text(detail.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(1)
                    Spacer(minLength: Tokens.Space.s2)
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                }
                Text(item.text).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(1)
                Text("\(item.sender) · \(IST.day(item.at))").font(.sc(.caption)).foregroundStyle(Tokens.textTertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(item.isRead ? "" : L.t("msgs.unread"))
    }
}

private struct ThreadRow: View {
    let thread: TeacherThread

    var body: some View {
        Card {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: thread.teacher, size: 44)
                VStack(alignment: .leading, spacing: 4) {
                    Text(thread.teacher).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    HStack(spacing: Tokens.Space.s2) {
                        if !thread.subject.isEmpty { Pill(text: L.known("subject", thread.subject)) }
                        if thread.isClassTeacher {
                            Pill(text: L.t("common.class_teacher"))
                        }
                    }
                    if thread.isActive {
                        Text(thread.lastText.isEmpty ? L.t("msgs.no_messages") : thread.lastText)
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                            .lineLimit(2)
                    } else {
                        Text(L.f("msgs.no_longer", L.known("subject", thread.subject)))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    if !thread.lastAt.isEmpty {
                        Text(IST.time(thread.lastAt))
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textTertiary)
                    }
                    if thread.unread > 0 {
                        Circle().fill(Tokens.danger).frame(width: 9, height: 9)
                            .accessibilityHidden(true)
                    }
                }
            }
        }
        .opacity(thread.isActive ? 1 : 0.55)
        .accessibilityElement(children: .combine)
        .accessibilityValue(thread.unread > 0 ? L.t("msgs.unread") : "")
    }
}
