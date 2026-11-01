import SwiftUI

struct ExamDetailView: View {
    let examId: String

    @Environment(Session.self) private var session
    @State private var vm = ExamDetailViewModel()

    var body: some View {
        ScreenScroll {
            LoadableView(vm.detail, retry: { Task { await reload() } }) { detail in
                TwoToneTitle(ink: detail.name, grey: "\(Int(detail.percentage.rounded()))%", role: .title1)

                Card {
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(detail.subjects) { mark in
                            HStack {
                                Text(mark.subject).font(.sc(.body)).foregroundStyle(Tokens.text)
                                Spacer()
                                Text("\(mark.marks)/\(mark.max)")
                                    .font(.sc(.body, weight: .medium))
                                    .foregroundStyle(Tokens.text)
                                Pill(text: mark.grade, tone: .neutral)
                            }
                            .accessibilityElement(children: .combine)
                            Separator()
                        }
                        HStack {
                            Text("Total").font(.sc(.body, weight: .bold)).foregroundStyle(Tokens.text)
                            Spacer()
                            Text("\(detail.total)/\(detail.maxTotal)")
                                .font(.sc(.body, weight: .bold))
                                .foregroundStyle(Tokens.text)
                        }
                        InfoRow(label: "Percentage", value: String(format: "%.1f%%", detail.percentage))
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        SectionLabel("Class teacher's remark")
                        Text(detail.remark).font(.sc(.body)).foregroundStyle(Tokens.text)
                    }
                }

                Text("Published \(IST.dateTime(detail.publishedAt)) IST")
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, examId: examId)
    }
}
