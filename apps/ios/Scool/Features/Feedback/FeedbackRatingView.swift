import SwiftUI

/// Rate each teacher of the child. Read-only once answered.
struct FeedbackRatingView: View {
    let child: Child
    let request: FeedbackRequest

    @Environment(Session.self) private var session
    @State private var vm = FeedbackFormViewModel()

    private var current: FeedbackRequest { vm.submitted ?? request }
    private var isReadOnly: Bool { current.isAnswered || child.hasLeft }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Feedback.", grey: current.title, role: .title1)

            if current.isAnswered {
                Card {
                    Text("Thank you. Your feedback is anonymous to teachers.")
                        .font(.sc(.callout, weight: .medium))
                        .foregroundStyle(Tokens.text)
                }
            } else {
                Text("Closes on \(IST.date(current.closesOn)). Rate at least one teacher.")
                    .font(.sc(.callout))
                    .foregroundStyle(Tokens.textSecondary)
            }

            ForEach(current.targets) { target in
                targetCard(target)
            }

            if !isReadOnly {
                if let error = vm.errorText {
                    Text(error)
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.danger)
                }
                PrimaryButton(title: "Submit", style: .brand, isLoading: vm.isSubmitting, isEnabled: vm.canSubmit) {
                    Task { await vm.submit(repo: session.repo, request: request, childId: child.id) }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func targetCard(_ target: FeedbackTarget) -> some View {
        let saved = current.ratings.first(where: { $0.targetId == target.id })
        return Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s3) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(target.teacher).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                        Text(target.subject).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                    }
                    Spacer()
                    if target.isClassTeacher {
                        Pill(text: "Class teacher")
                    }
                }
                if isReadOnly {
                    StarRatingView(rating: .constant(saved?.rating ?? 0), isReadOnly: true)
                    if let comment = saved?.comment, !comment.isEmpty {
                        Text(comment).font(.sc(.callout)).foregroundStyle(Tokens.text)
                    }
                } else {
                    StarRatingView(rating: Binding(
                        get: { vm.ratings[target.id] ?? 0 },
                        set: { vm.ratings[target.id] = $0 }))
                    CommentField(text: Binding(
                        get: { vm.comments[target.id] ?? "" },
                        set: { vm.comments[target.id] = $0 }))
                }
            }
        }
    }
}

/// Optional comment with a 500 character limit and counter.
private struct CommentField: View {
    @Binding var text: String

    var body: some View {
        VStack(alignment: .trailing, spacing: Tokens.Space.s1) {
            TextEditor(text: $text)
                .font(.sc(.callout))
                .scrollContentBackground(.hidden)
                .padding(Tokens.Space.s2)
                .frame(minHeight: 88)
                .background(Tokens.bg, in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("Comment (optional)")
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textTertiary)
                            .padding(.horizontal, Tokens.Space.s3)
                            .padding(.vertical, Tokens.Space.s2 + 8)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .accessibilityLabel("Comment, optional")
                .onChange(of: text) { _, newValue in
                    if newValue.count > Feedback.maxCommentLength {
                        text = String(newValue.prefix(Feedback.maxCommentLength))
                    }
                }
            Text("\(text.count)/\(Feedback.maxCommentLength)")
                .font(.sc(.caption))
                .foregroundStyle(Tokens.textTertiary)
                .accessibilityLabel("\(text.count) of \(Feedback.maxCommentLength) characters")
        }
    }
}
