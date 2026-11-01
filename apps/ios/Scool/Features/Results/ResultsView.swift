import SwiftUI

struct ResultsView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = ResultsViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: "Results.", grey: "Published exams for \(child.firstName).", role: .title1)
                LoadableView(vm.exams, retry: { Task { await reload() } }) { exams in
                    if exams.isEmpty {
                        EmptyNote(text: "No results have been published yet.")
                    }
                    ForEach(exams) { exam in
                        NavigationLink(value: exam) {
                            Card {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(exam.name).font(.sc(.body, weight: .semibold))
                                            .foregroundStyle(Tokens.text)
                                        Text(IST.day(exam.publishedAt))
                                            .font(.sc(.callout))
                                            .foregroundStyle(Tokens.textSecondary)
                                    }
                                    Spacer()
                                    Text("\(Int(exam.percentage.rounded()))%")
                                        .font(.sc(.title3))
                                        .foregroundStyle(Tokens.accent)
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Tokens.textTertiary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: ExamSummary.self) { exam in
                ExamDetailView(examId: exam.id)
            }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }
}
