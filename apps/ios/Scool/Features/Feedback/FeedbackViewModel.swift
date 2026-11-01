import Foundation
import Observation

/// Open feedback requests for the selected child.
@Observable
@MainActor
final class FeedbackViewModel {
    var requests: Loadable<[FeedbackRequest]> = .loading

    func load(repo: any Repository, childId: String) async {
        let result = await Loadable<[FeedbackRequest]>.capture { try await repo.feedbackRequests(childId: childId) }
        if let list = result.value {
            // Pending first, then answered; earliest closing date first.
            requests = .loaded(list.sorted {
                ($0.isAnswered ? 1 : 0, $0.closesOn) < ($1.isAnswered ? 1 : 0, $1.closesOn)
            })
        } else {
            requests = result
        }
    }
}

/// Form state for one request.
@Observable
@MainActor
final class FeedbackFormViewModel {
    var ratings: [String: Int] = [:]      // targetId -> stars
    var comments: [String: String] = [:]  // targetId -> text
    var isSubmitting = false
    var errorText: String?
    var submitted: FeedbackRequest?

    var canSubmit: Bool {
        !isSubmitting && ratings.values.contains { $0 > 0 }
    }

    func submit(repo: any Repository, request: FeedbackRequest, childId: String) async {
        var list: [FeedbackRating] = []
        for target in request.targets {
            guard let stars = ratings[target.id], stars > 0 else { continue }
            let text = (comments[target.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let comment: String? = text.isEmpty ? nil : String(text.prefix(Feedback.maxCommentLength))
            list.append(FeedbackRating(targetId: target.id, rating: stars, comment: comment))
        }
        guard !list.isEmpty else { return }
        isSubmitting = true
        errorText = nil
        do {
            submitted = try await repo.submitFeedback(requestId: request.id, childId: childId, ratings: list)
        } catch {
            errorText = error.localizedDescription
        }
        isSubmitting = false
    }
}
