import UIKit

/// Builds a one-page A5 fee receipt PDF. Labels follow the app language and use the system font,
/// which draws Devanagari. The amount in words is always English, and money is printed as "Rs."
/// so it never depends on a font having the rupee glyph.
enum ReceiptPDF {
    private static let pageSize = CGSize(width: 419.5, height: 595.3)   // A5 in points
    private static let margin: CGFloat = 32

    /// Writes the PDF to a temporary file and returns it, or nil if rendering failed.
    static func make(child: Child, invoice: Invoice, payment: Payment) -> URL? {
        let safeNo = payment.receiptNo.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Receipt-\(safeNo).pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        do {
            try renderer.writePDF(to: url) { context in
                context.beginPage()
                draw(child: child, invoice: invoice, payment: payment)
            }
            return url
        } catch {
            return nil
        }
    }

    private static func rupees(_ paise: Int) -> String {
        "Rs. " + String(Money.format(paise: paise).dropFirst())
    }

    private static func draw(child: Child, invoice: Invoice, payment: Payment) {
        let width = pageSize.width - margin * 2
        var y: CGFloat = margin

        y += text(School.name, x: margin, y: y, width: width, size: 20, weight: .bold, align: .center) + 2
        y += text(School.city, x: margin, y: y, width: width, size: 11, gray: 0.4, align: .center) + 14
        y += text(L.t("rcpt.title"), x: margin, y: y, width: width, size: 15, weight: .semibold, align: .center) + 8
        rule(y: y)
        y += 14

        let rows: [(String, String)] = [
            (L.t("rcpt.receipt_no"), payment.receiptNo),
            (L.t("rcpt.date"), "\(IST.dateTime(payment.at)) IST"),
            (L.t("rcpt.student"), child.name),
            (L.t("rcpt.class"), child.classLabel),
            (L.t("rcpt.scholar_no"), child.scholarNo),
            (L.t("rcpt.invoice"), "\(invoice.no) (\(invoice.periodTitle))"),
            (L.t("rcpt.mode"), payment.modeTitle),
            (L.t("rcpt.reference"), payment.reference),
            (L.t("rcpt.received_by"), payment.receivedBy)
        ]
        let labelWidth: CGFloat = 120
        for (label, value) in rows {
            let a = text(label, x: margin, y: y, width: labelWidth - 8, size: 10.5, gray: 0.4)
            let b = text(value, x: margin + labelWidth, y: y, width: width - labelWidth, size: 11.5, weight: .medium)
            y += max(a, b) + 8
        }

        y += 6
        rule(y: y)
        y += 14
        y += text(L.t("rcpt.amount"), x: margin, y: y, width: width, size: 10.5, gray: 0.4) + 2
        y += text(rupees(payment.amountPaise), x: margin, y: y, width: width, size: 26, weight: .bold) + 4
        y += text(AmountInWords.english(paise: payment.amountPaise), x: margin, y: y, width: width, size: 11) + 14
        rule(y: y)

        _ = text(L.t("rcpt.footer"), x: margin, y: pageSize.height - margin - 14, width: width,
                 size: 9.5, gray: 0.45, align: .center)
    }

    /// Draws wrapped text and returns the height it used.
    @discardableResult
    private static func text(_ string: String, x: CGFloat, y: CGFloat, width: CGFloat, size: CGFloat,
                             weight: UIFont.Weight = .regular, gray: CGFloat = 0.1,
                             align: NSTextAlignment = .left) -> CGFloat {
        let style = NSMutableParagraphStyle()
        style.alignment = align
        style.lineSpacing = 2
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: UIColor(white: gray, alpha: 1),
            .paragraphStyle: style
        ]
        let ns = string as NSString
        let bounds = ns.boundingRect(with: CGSize(width: width, height: .greatestFiniteMagnitude),
                                     options: [.usesLineFragmentOrigin], attributes: attributes, context: nil)
        let height = ceil(bounds.height)
        ns.draw(in: CGRect(x: x, y: y, width: width, height: height), withAttributes: attributes)
        return height
    }

    private static func rule(y: CGFloat) {
        UIColor(white: 0.8, alpha: 1).setFill()
        UIRectFill(CGRect(x: margin, y: y, width: pageSize.width - margin * 2, height: 0.5))
    }
}
