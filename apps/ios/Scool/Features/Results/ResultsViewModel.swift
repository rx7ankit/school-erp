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

    var isBuilding = false
    var reportError = false

    /// Attendance for the three months up to the month the exam was published, half day = 0.5.
    /// Returns the PDF file, or nil when it could not be built.
    func reportCard(repo: any Repository, child: Child, detail: ExamDetail) async -> URL? {
        isBuilding = true
        reportError = false
        defer { isBuilding = false }
        let last = IST.month(of: detail.publishedAt)
        let first = IST.addMonths(last, -2)
        var days: [AttendanceDay] = []
        var month = first
        while month <= last {
            days += (try? await repo.attendanceMonth(childId: child.id, month: month)) ?? []
            month = IST.addMonths(month, 1)
        }
        let attendance: ReportCardPDF.Attendance? = days.isEmpty ? nil : ReportCardPDF.Attendance(
            percentage: AttendanceStats(days: days).percentage,
            periodTitle: L.f("rc.period_fmt", IST.monthTitle(first), IST.monthTitle(last)))
        let url = ReportCardPDF.make(child: child, detail: detail, attendance: attendance)
        reportError = url == nil
        return url
    }
}
