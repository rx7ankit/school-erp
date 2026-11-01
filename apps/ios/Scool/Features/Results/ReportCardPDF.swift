import UIKit

/// Builds a one-page A4 report card PDF. English labels, system font, no rupee glyph needed.
enum ReportCardPDF {
    private static let pageSize = CGSize(width: 595.3, height: 841.9)   // A4 in points
    private static let margin: CGFloat = 44

    struct Attendance {
        let percentage: Double
        let periodTitle: String        // "August 2026 to October 2026"
    }

    /// Writes the PDF to a temporary file and returns it, or nil if rendering failed.
    static func make(child: Child, detail: ExamDetail, attendance: Attendance?) -> URL? {
        let safeId = detail.id.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("ReportCard-\(child.scholarNo)-\(safeId).pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        do {
            try renderer.writePDF(to: url) { context in
                context.beginPage()
                draw(child: child, detail: detail, attendance: attendance)
            }
            return url
        } catch {
            return nil
        }
    }

    private static func draw(child: Child, detail: ExamDetail, attendance: Attendance?) {
        let width = pageSize.width - margin * 2
        var y: CGFloat = margin

        y += PDFDraw.text(School.name, x: margin, y: y, width: width, size: 24, weight: .bold, align: .center) + 2
        y += PDFDraw.text(School.city, x: margin, y: y, width: width, size: 12, gray: 0.4, align: .center) + 16
        y += PDFDraw.text(L.t("rc.title"), x: margin, y: y, width: width, size: 18, weight: .semibold, align: .center) + 4
        y += PDFDraw.text(detail.name, x: margin, y: y, width: width, size: 13, gray: 0.3, align: .center) + 10
        PDFDraw.rule(x: margin, y: y, width: width)
        y += 14

        let info: [(String, String)] = [
            (L.t("rc.student"), child.name),
            (L.t("rcpt.class"), child.classLabel),
            (L.t("rcpt.scholar_no"), child.scholarNo)
        ]
        for (label, value) in info {
            let a = PDFDraw.text(label, x: margin, y: y, width: 110, size: 11, gray: 0.4)
            let b = PDFDraw.text(value, x: margin + 120, y: y, width: width - 120, size: 12.5, weight: .medium)
            y += max(a, b) + 6
        }
        y += 8

        // Table: subject | marks | maximum | grade
        let colSubject = margin
        let colMarks = margin + width * 0.52
        let colMax = margin + width * 0.68
        let colGrade = margin + width * 0.84
        let numWidth = width * 0.14
        func row(_ cells: [String], weight: UIFont.Weight, gray: CGFloat = 0.1) {
            PDFDraw.text(cells[0], x: colSubject, y: y, width: width * 0.5, size: 12, weight: weight, gray: gray)
            PDFDraw.text(cells[1], x: colMarks, y: y, width: numWidth, size: 12, weight: weight, gray: gray)
            PDFDraw.text(cells[2], x: colMax, y: y, width: numWidth, size: 12, weight: weight, gray: gray)
            PDFDraw.text(cells[3], x: colGrade, y: y, width: numWidth, size: 12, weight: weight, gray: gray)
            y += 22
        }
        PDFDraw.rule(x: margin, y: y, width: width)
        y += 6
        row([L.t("rc.subject"), L.t("rc.marks"), L.t("rc.max"), L.t("rc.grade")], weight: .semibold, gray: 0.4)
        PDFDraw.rule(x: margin, y: y, width: width)
        y += 6
        for mark in detail.subjects {
            row([L.known("subject", mark.subject), "\(mark.marks)", "\(mark.max)", mark.grade], weight: .regular)
        }
        PDFDraw.rule(x: margin, y: y, width: width)
        y += 6
        row([L.t("results.total"), "\(detail.total)", "\(detail.maxTotal)", ""], weight: .bold)
        PDFDraw.rule(x: margin, y: y, width: width)
        y += 14

        let percentage = detail.percentage
        let summary: [(String, String)] = [
            (L.t("results.percentage"), String(format: "%.1f%%", percentage)),
            (L.t("rc.overall_grade"), Grading.letter(percentage: percentage)),
            (L.t("rc.attendance"), attendance.map { String(format: "%.1f%% (%@)", $0.percentage, $0.periodTitle) } ?? "-")
        ]
        for (label, value) in summary {
            let a = PDFDraw.text(label, x: margin, y: y, width: 150, size: 11, gray: 0.4)
            let b = PDFDraw.text(value, x: margin + 160, y: y, width: width - 160, size: 12.5, weight: .semibold)
            y += max(a, b) + 6
        }
        y += 10

        y += PDFDraw.text(L.t("results.remark"), x: margin, y: y, width: width, size: 11, gray: 0.4) + 3
        y += PDFDraw.text(detail.remark, x: margin, y: y, width: width, size: 12.5) + 18

        PDFDraw.rule(x: margin, y: y, width: width)
        _ = PDFDraw.text(L.f("rc.issued", IST.day(IST.nowISO())), x: margin, y: pageSize.height - margin - 14,
                         width: width, size: 10, gray: 0.45, align: .center)
    }
}
