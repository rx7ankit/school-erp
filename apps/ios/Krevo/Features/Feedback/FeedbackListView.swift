import SwiftUI

/// Pushed from More (or the Home card). Lists the selected child's open feedback requests.
struct FeedbackListView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = FeedbackViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("fb.ink"), grey: L.f("fb.list_grey", child.firstName), role: .title1)

            if child.hasLeft {
                EmptyNote(text: L.f("fb.left", child.firstName))
            } else {
                LoadableView(vm.requests, retry: { Task { await reload() } }, skeleton: {
                    VStack(spacing: Tokens.Space.s4) {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonCard {
                                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                                    HStack {
                                        SkeletonLine(width: 160, role: .body)
                                        Spacer()
                                        SkeletonPill(width: 64)
                                    }
                                    SkeletonLine(width: 150, role: .callout)
                                    SkeletonLine(width: 80, role: .caption)
                                }
                            }
                        }
                    }
                }) { list in
                    if list.isEmpty {
                        EmptyNote(text: L.t("fb.empty"))
                    }
                    ForEach(list) { request in
                        NavigationLink(value: request) {
                            row(request)
                        }
                        .buttonStyle(.pressable)
                    }
                }
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: FeedbackRequest.self) { request in
            FeedbackRatingView(child: child, request: request)
        }
        .task { await reload() }
    }

    private func reload() async {
        guard !child.hasLeft else { return }
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func row(_ request: FeedbackRequest) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Text(request.title).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    Spacer()
                    Pill(text: request.isAnswered ? L.t("fb.answered") : L.t("fb.open"), tone: request.isAnswered ? .success : .neutral)
                }
                Text(L.f("fb.closes", IST.date(request.closesOn)))
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.textSecondary)
                Text(L.f("fb.teachers", String(request.targets.count)))
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
