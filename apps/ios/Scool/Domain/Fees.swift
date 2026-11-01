import Foundation

enum InvoiceStatus {
    case paid, partial, unpaid

    var title: String {
        switch self {
        case .paid: return L.t("fees.status.paid")
        case .partial: return L.t("fees.status.partial")
        case .unpaid: return L.t("fees.status.unpaid")
        }
    }
}

enum InvoiceLineKind: Hashable {
    case fee            // a fee head
    case discount       // concession, amount is negative
    case lateFee
    case previousDues
}

struct InvoiceLine: Identifiable, Hashable {
    let title: String
    let amountPaise: Int          // negative for discounts
    var kind: InvoiceLineKind = .fee
    var id: String { title }
}

enum PaymentStatus: Hashable {
    case active
    case cancelled      // cancelled by the school
}

struct Payment: Identifiable, Hashable {
    let id: String
    let receiptNo: String
    let mode: String          // "UPI", "Cash", "Cheque"
    let reference: String     // UPI ref, cheque number, or "-" for cash
    let receivedBy: String    // school staff who recorded it
    let amountPaise: Int
    let at: String
    var status: PaymentStatus = .active

    var isActive: Bool { status == .active }

    /// Mode name (falls back to the raw value for unknown modes).
    var modeTitle: String {
        L.known("mode", mode)
    }
}

struct Invoice: Identifiable, Hashable {
    let id: String
    let no: String
    let period: String
    let dueOn: String
    let lines: [InvoiceLine]
    let payments: [Payment]

    /// Fee heads + late fee + previous dues - discounts.
    var totalPaise: Int { lines.reduce(0) { $0 + $1.amountPaise } }
    /// Cancelled payments do not count.
    var paidPaise: Int { payments.filter(\.isActive).reduce(0) { $0 + $1.amountPaise } }

    var periodTitle: String { L.known("period", period) }
    var duePaise: Int { max(totalPaise - paidPaise, 0) }
    var status: InvoiceStatus {
        if paidPaise >= totalPaise { return .paid }
        return paidPaise > 0 ? .partial : .unpaid
    }
}
