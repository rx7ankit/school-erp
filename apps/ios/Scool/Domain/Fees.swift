import Foundation

enum InvoiceStatus {
    case paid, partial, unpaid

    var title: String {
        switch self {
        case .paid: return "Paid"
        case .partial: return "Partial"
        case .unpaid: return "Unpaid"
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
    let amountPaise: Int
    let at: String
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

    var duePaise: Int { max(totalPaise - paidPaise, 0) }
    var status: InvoiceStatus {
        if paidPaise >= totalPaise { return .paid }
        return paidPaise > 0 ? .partial : .unpaid
    }
}
