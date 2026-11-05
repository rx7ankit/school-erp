import Foundation

struct ExamSummary: Identifiable, Hashable {
    let id: String
    let name: String
    let publishedAt: String
    let percentage: Double
}

struct SubjectMark: Identifiable, Hashable {
    let subject: String
    let marks: Double
    let max: Int
    let grade: String
    var id: String { subject }
}

struct ExamDetail {
    let id: String
    let name: String
    let publishedAt: String
    let subjects: [SubjectMark]
    let remark: String

    var total: Double { subjects.reduce(0) { $0 + $1.marks } }
    var maxTotal: Int { subjects.reduce(0) { $0 + $1.max } }
    var percentage: Double { maxTotal == 0 ? 0 : total / Double(maxTotal) * 100 }
}
