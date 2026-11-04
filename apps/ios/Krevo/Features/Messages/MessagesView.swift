import SwiftUI

/// Hashable marker for the Updates screen in the navigation stack.
struct UpdatesRoute: Hashable {}

struct MessagesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = MessagesViewModel()

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

                updatesRow

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
                        .buttonStyle(.plain)
                    }
                    if !previous.isEmpty {
                        SectionLabel(L.t("msgs.previous"))
                        ForEach(previous) { thread in
                            NavigationLink(value: thread) {
                                ThreadRow(thread: thread)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: UpdatesRoute.self) { _ in
                UpdatesView(child: child)
            }
            .navigationDestination(for: TeacherThread.self) { thread in
                ChatView(thread: thread, child: child)
            }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    // MARK: Updates row (pinned at the top)

    private var updatesRow: some View {
        NavigationLink(value: UpdatesRoute()) {
            Card {
                LoadableView(vm.updates, retry: { Task { await reload() } }, skeleton: {
                    HStack(alignment: .top, spacing: Tokens.Space.s3) {
                        SkeletonCircle(size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            SkeletonLine(width: 110, role: .body)
                            SkeletonLine(width: 150, role: .caption)
                            SkeletonLine(role: .callout)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }) { list in
                    let latest = list.max { $0.at < $1.at }
                    let unread = list.filter { !$0.isRead }.count
                    HStack(alignment: .top, spacing: Tokens.Space.s3) {
                        Image(systemName: "megaphone")
                            .font(.system(size: 18))
                            .foregroundStyle(Tokens.text)
                            .frame(width: 44, height: 44)
                            .background(Tokens.fill, in: Circle())
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: Tokens.Space.s2) {
                                Text(L.t("msgs.updates")).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                                if unread > 0 {
                                    Circle().fill(Tokens.danger).frame(width: 8, height: 8).accessibilityHidden(true)
                                    Text(L.f("msgs.updates_new", String(unread)))
                                        .font(.sc(.caption, weight: .semibold))
                                        .foregroundStyle(Tokens.textSecondary)
                                }
                            }
                            if let latest {
                                Text("\(latest.sender) - \(L.known("subject", latest.tag))")
                                    .font(.sc(.caption))
                                    .foregroundStyle(Tokens.textSecondary)
                                Text(latest.text)
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textSecondary)
                                    .lineLimit(2)
                            } else {
                                Text(L.t("msgs.no_updates"))
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textSecondary)
                            }
                        }
                        Spacer(minLength: 0)
                        if let latest {
                            Text(IST.time(latest.at))
                                .font(.sc(.caption))
                                .foregroundStyle(Tokens.textTertiary)
                        }
                    }
                }
            }
        }
        .buttonStyle(.plain)
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
                        Pill(text: L.known("subject", thread.subject))
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
