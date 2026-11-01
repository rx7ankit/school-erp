import SwiftUI

/// Pushed from More (or the Home card). Lists the selected child's open feedback requests.
struct FeedbackListView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = FeedbackViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Feedback.", grey: "Rate \(child.firstName)'s teachers.", role: .title1)

            if child.hasLeft {
                EmptyNote(text: "\(child.firstName) has left school, so there are no feedback requests.")
            } else {
                LoadableView(vm.requests, retry: { Task { await reload() } }) { list in
                    if list.isEmpty {
                        EmptyNote(text: "No feedback requests right now.")
                    }
                    ForEach(list) { request in
                        NavigationLink(value: request) {
                            row(request)
                        }
                        .buttonStyle(.plain)
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
                    Pill(text: request.isAnswered ? "Answered" : "Open", tone: request.isAnswered ? .success : .neutral)
                }
                Text("Closes on \(IST.date(request.closesOn))")
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.textSecondary)
                Text("\(request.targets.count) teachers")
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
