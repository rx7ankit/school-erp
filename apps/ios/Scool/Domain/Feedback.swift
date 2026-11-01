import Foundation

/// One teacher the parent can rate.
struct FeedbackTarget: Identifiable, Hashable {
    let id: String
    let teacher: String
    let subject: String
    let isClassTeacher: Bool
}

/// One star rating (1 to 5) with an optional comment of at most 500 characters.
struct FeedbackRating: Hashable {
    let targetId: String
    let rating: Int
    let comment: String?
}

/// A school request to rate teachers. `ratings` is empty until this child's parent has answered.
struct FeedbackRequest: Identifiable, Hashable {
    let id: String
    let title: String
    let closesOn: String        // date-only "2026-11-22"
    let targets: [FeedbackTarget]
    let ratings: [FeedbackRating]

    var isAnswered: Bool { !ratings.isEmpty }

    func answered(with ratings: [FeedbackRating]) -> FeedbackRequest {
        FeedbackRequest(id: id, title: title, closesOn: closesOn, targets: targets, ratings: ratings)
    }
}

enum Feedback {
    static let maxCommentLength = 500
}
