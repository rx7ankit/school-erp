import SwiftUI

struct ResultsView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = ResultsViewModel()

    var body: some View {
        NavigationStack {
            ScreenScroll {
                LoadableView(vm.exams, retry: { Task { await reload() } }, skeleton: {
                    VStack(spacing: Tokens.Space.s4) {
                        ForEach(0..<4, id: \.self) { _ in
                            SkeletonCard {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        SkeletonLine(width: 150, role: .body)
                                        SkeletonLine(width: 100, role: .callout)
                                    }
                                    Spacer()
                                    SkeletonLine(width: 44, role: .title3)
                                    SkeletonBlock(width: 8, height: 13, radius: 3)
                                }
                            }
                        }
                    }
                }) { exams in
                    if exams.isEmpty {
                        EmptyNote(text: L.t("results.empty"))
                    }
                    ForEach(ResultsViewModel.current(exams)) { exam in
                        examRow(exam)
                    }
                    let past = ResultsViewModel.pastYears(exams)
                    if !past.isEmpty {
                        SectionLabel(L.t("results.past_years"))
                        ForEach(past) { group in
                            Text(L.f("results.year_fmt", group.year))
                                .font(.sc(.callout, weight: .semibold))
                                .foregroundStyle(Tokens.textSecondary)
                                .accessibilityAddTraits(.isHeader)
                            ForEach(group.exams) { exam in
                                examRow(exam)
                            }
                        }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: ExamSummary.self) { exam in
                ExamDetailView(child: child, examId: exam.id)
                    .hidesTabBar()
            }
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func examRow(_ exam: ExamSummary) -> some View {
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
                        .foregroundStyle(Tokens.text)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Tokens.textTertiary)
                }
            }
        }
        .buttonStyle(.pressable)
    }
}
