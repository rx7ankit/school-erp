import Foundation
import Observation

@Observable
@MainActor
final class ResultsViewModel {
    var exams: Loadable<[ExamSummary]> = .loading

    func load(repo: any Repository, childId: String) async {
        let result = await Loadable<[ExamSummary]>.capture { try await repo.exams(childId: childId) }
        if let list = result.value {
            exams = .loaded(list.sorted { $0.publishedAt > $1.publishedAt })
        } else {
            exams = result
        }
    }
}

@Observable
@MainActor
final class ExamDetailViewModel {
    var detail: Loadable<ExamDetail> = .loading

    func load(repo: any Repository, examId: String) async {
        detail = await Loadable<ExamDetail>.capture { try await repo.examDetail(id: examId) }
    }
}
