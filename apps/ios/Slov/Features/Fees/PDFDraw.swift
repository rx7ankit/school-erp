import UIKit

/// Small drawing helpers shared by the PDF builders. Call only while a PDF page is active.
enum PDFDraw {
    /// Draws wrapped text and returns the height it used.
    @discardableResult
    static func text(_ string: String, x: CGFloat, y: CGFloat, width: CGFloat, size: CGFloat,
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

    static func rule(x: CGFloat, y: CGFloat, width: CGFloat) {
        UIColor(white: 0.8, alpha: 1).setFill()
        UIRectFill(CGRect(x: x, y: y, width: width, height: 0.5))
    }
}
