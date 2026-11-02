import Foundation

/// One paper of an exam: a start timestamp (UTC, shown in IST) and a subject.
struct ExamPaper: Identifiable, Hashable {
    let id: String
    let subject: String
    let startAt: String
}

/// An exam with its date sheet, for one class.
struct ExamSchedule: Identifiable, Hashable {
    let id: String
    let name: String
    let classLabel: String
    let fromOn: String          // date-only
    let toOn: String            // date-only
    let papers: [ExamPaper]
}
