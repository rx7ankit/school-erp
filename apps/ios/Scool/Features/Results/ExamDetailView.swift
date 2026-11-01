import SwiftUI

struct ExamDetailView: View {
    let child: Child
    let examId: String

    @Environment(Session.self) private var session
    @State private var vm = ExamDetailViewModel()
    @State private var shared: SharedFile?

    var body: some View {
        ScreenScroll {
            LoadableView(vm.detail, retry: { Task { await reload() } }) { detail in
                TwoToneTitle(ink: detail.name, grey: "\(Int(detail.percentage.rounded()))%", role: .title1)

                Card {
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(detail.subjects) { mark in
                            HStack {
                                Text(L.known("subject", mark.subject)).font(.sc(.body)).foregroundStyle(Tokens.text)
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
                            Text(L.t("results.total")).font(.sc(.body, weight: .bold)).foregroundStyle(Tokens.text)
                            Spacer()
                            Text("\(detail.total)/\(detail.maxTotal)")
                                .font(.sc(.body, weight: .bold))
                                .foregroundStyle(Tokens.text)
                        }
                        InfoRow(label: L.t("results.percentage"), value: String(format: "%.1f%%", detail.percentage))
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        SectionLabel(L.t("results.remark"))
                        Text(detail.remark).font(.sc(.body)).foregroundStyle(Tokens.text)
                    }
                }

                Text(L.f("results.published", IST.dateTime(detail.publishedAt)))
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)

                PrimaryButton(title: L.t("results.download"), style: .solid, isLoading: vm.isBuilding) {
                    Task {
                        if let url = await vm.reportCard(repo: session.repo, child: child, detail: detail) {
                            shared = SharedFile(url: url)
                        }
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .sheet(item: $shared) { file in
            ShareSheet(url: file.url)
        }
        .alert(L.t("results.report_error"), isPresented: $vm.reportError) {
            Button(L.t("common.ok"), role: .cancel) {}
        }
    }

    private func reload() async {
        await vm.load(repo: session.repo, examId: examId)
    }
}
