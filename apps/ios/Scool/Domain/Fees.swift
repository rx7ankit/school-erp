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

struct InvoiceLine: Identifiable, Hashable {
    let title: String
    let amountPaise: Int
    var id: String { title }
}

struct Payment: Identifiable, Hashable {
    let id: String
    let receiptNo: String
    let mode: String          // "UPI", "Cash", "Cheque"
    let reference: String     // UPI ref, cheque number, or "-" for cash
    let receivedBy: String    // school staff who recorded it
    let amountPaise: Int
    let at: String

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
    let totalPaise: Int
    let paidPaise: Int
    let lines: [InvoiceLine]
    let payments: [Payment]

    var periodTitle: String { L.known("period", period) }
    var duePaise: Int { max(totalPaise - paidPaise, 0) }
    var status: InvoiceStatus {
        if paidPaise >= totalPaise { return .paid }
        return paidPaise > 0 ? .partial : .unpaid
    }
}
