import Foundation
import Observation

/// Exams of one past academic year.
struct ExamYearGroup: Identifiable {
    let year: String            // "2025-26"
    let exams: [ExamSummary]
    var id: String { year }
}

@Observable
@MainActor
final class ResultsViewModel {
    var exams: Loadable<[ExamSummary]> = .loading

    /// Exams of the current academic year (April to March, IST), newest first.
    static func current(_ list: [ExamSummary]) -> [ExamSummary] {
        let year = IST.currentAcademicYear()
        return list.filter { IST.academicYear(of: $0.publishedAt) == year }
    }

    /// Older exams grouped by academic year, newest year first, newest exam first inside a year.
    static func pastYears(_ list: [ExamSummary]) -> [ExamYearGroup] {
        let year = IST.currentAcademicYear()
        let older = list.filter { IST.academicYear(of: $0.publishedAt) != year }
        let grouped = Dictionary(grouping: older) { IST.academicYear(of: $0.publishedAt) }
        return grouped.keys.sorted(by: >).map { key in
            ExamYearGroup(year: key, exams: (grouped[key] ?? []).sorted { $0.publishedAt > $1.publishedAt })
        }
    }

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
