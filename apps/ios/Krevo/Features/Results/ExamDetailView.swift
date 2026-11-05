import SwiftUI

struct ExamDetailView: View {
    let child: Child
    let examId: String

    @Environment(Session.self) private var session
    @State private var vm = ExamDetailViewModel()
    @State private var shared: SharedFile?

    var body: some View {
        ScreenScroll {
            LoadableView(vm.detail, retry: { Task { await reload() } }, skeleton: { ExamDetailSkeleton() }) { detail in
                TwoToneTitle(ink: detail.name, grey: "", role: .title1)

                Card {
                    VStack(spacing: Tokens.Space.s3) {
                        ForEach(detail.subjects) { mark in
                            HStack {
                                Text(L.known("subject", mark.subject)).font(.sc(.body)).foregroundStyle(Tokens.text)
                                Spacer()
                                Text("\(Self.number(mark.marks))/\(mark.max)")
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
                            Text("\(Self.number(detail.total))/\(detail.maxTotal)")
                                .font(.sc(.body, weight: .bold))
                                .foregroundStyle(Tokens.text)
                        }
                        InfoRow(label: L.t("results.percentage"), value: String(format: "%.1f%%", detail.percentage))
                    }
                }

                // Only when the class teacher wrote one.
                if !detail.remark.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                            SectionLabel(L.t("results.remark"))
                            Text(detail.remark).font(.sc(.body)).foregroundStyle(Tokens.text)
                        }
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

    /// 18 stays "18", 17.5 stays "17.5".
    static func number(_ value: Double) -> String {
        // At most two decimals, none when it is a whole number: 351, 62.5, 351.25.
        let text = String(format: "%.2f", value)
        return text.replacingOccurrences(of: "\\.?0+$", with: "", options: .regularExpression)
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id, examId: examId)
    }
}

/// Mirrors the title, marks card, remark card, published line and download button.
private struct ExamDetailSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s4) {
            SkeletonLine(width: 240, role: .title1)
            SkeletonCard {
                VStack(spacing: Tokens.Space.s3) {
                    ForEach(0..<5, id: \.self) { _ in
                        HStack {
                            SkeletonLine(width: 110, role: .body)
                            Spacer()
                            SkeletonLine(width: 56, role: .body)
                            SkeletonPill(width: 34)
                        }
                        Separator()
                    }
                    HStack {
                        SkeletonLine(width: 60, role: .body)
                        Spacer()
                        SkeletonLine(width: 70, role: .body)
                    }
                    HStack {
                        SkeletonLine(width: 90, role: .callout)
                        Spacer()
                        SkeletonLine(width: 50, role: .callout)
                    }
                }
            }
            SkeletonCard {
                VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                    SkeletonLine(width: 70, role: .caption)
                    SkeletonLine(role: .body)
                    SkeletonLine(width: 180, role: .body)
                }
            }
            SkeletonLine(width: 200, role: .caption)
            SkeletonBlock(height: Tokens.Control.lg, radius: Tokens.Control.lg / 2)
        }
    }
}
