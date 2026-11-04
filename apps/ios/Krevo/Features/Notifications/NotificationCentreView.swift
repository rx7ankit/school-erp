import SwiftUI

/// Opened by the bell on Home. Newest first, unread state, mark all read, tap to open the related screen.
struct NotificationCentreView: View {
    let selected: Child
    let children: [Child]

    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var vm = NotificationsViewModel()

    private var childIds: [String] { children.map(\.id) }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("notif.ink"), grey: L.t("notif.grey"), role: .title1)

            if children.count > 1 {
                Picker(L.t("notif.filter"), selection: $vm.showAll) {
                    Text(selected.firstName).tag(false)
                    Text(L.t("notif.all_children")).tag(true)
                }
                .pickerStyle(.segmented)
            }

            LoadableView(vm.items, retry: { Task { await reload() } }, skeleton: {
                VStack(spacing: Tokens.Space.s4) {
                    ForEach(0..<5, id: \.self) { _ in
                        SkeletonCard {
                            HStack(alignment: .top, spacing: Tokens.Space.s3) {
                                SkeletonCircle(size: 36)
                                VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                                    SkeletonLine(width: 170, role: .body)
                                    SkeletonLine(role: .callout)
                                    SkeletonLine(width: 110, role: .caption)
                                }
                            }
                        }
                    }
                }
            }) { list in
                let shown = vm.visible(list, childId: selected.id)
                if list.contains(where: { !$0.isRead }) {
                    Button(L.t("notif.mark_all")) {
                        Task { await vm.markAllRead(repo: session.repo, childIds: childIds) }
                    }
                    .font(.sc(.callout, weight: .semibold))
                    .foregroundStyle(Tokens.text)
                    .frame(minHeight: Tokens.Control.md)
                }
                if shown.isEmpty {
                    EmptyNote(text: L.t("notif.empty"))
                }
                ForEach(shown) { item in
                    Button {
                        router.open(item.deepLink, childId: item.childId)
                        dismiss()
                    } label: {
                        row(item)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childIds: childIds)
    }

    private func row(_ item: AppNotification) -> some View {
        Card {
            HStack(alignment: .top, spacing: Tokens.Space.s3) {
                Image(systemName: item.systemImage)
                    .font(.system(size: 18))
                    .foregroundStyle(Tokens.text)
                    .frame(width: 36, height: 36)
                    .background(Tokens.fill, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                    HStack(spacing: Tokens.Space.s2) {
                        Text(item.title)
                            .font(.sc(.body, weight: item.isRead ? .medium : .bold))
                            .foregroundStyle(Tokens.text)
                        if !item.isRead {
                            Circle().fill(Tokens.danger).frame(width: 8, height: 8)
                                .accessibilityHidden(true)
                        }
                    }
                    Text(item.body)
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                    HStack(spacing: Tokens.Space.s2) {
                        Text(IST.dateTime(item.at))
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textTertiary)
                        if item.childId != selected.id {
                            Pill(text: item.childName)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(item.isRead ? "" : L.t("notif.unread"))
    }
}
