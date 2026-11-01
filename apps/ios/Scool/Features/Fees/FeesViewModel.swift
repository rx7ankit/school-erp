import Foundation
import Observation

@Observable
@MainActor
final class FeesViewModel {
    var invoices: Loadable<[Invoice]> = .loading

    func load(repo: any Repository, childId: String) async {
        let result = await Loadable<[Invoice]>.capture { try await repo.invoices(childId: childId) }
        if let list = result.value {
            invoices = .loaded(list.sorted { $0.dueOn > $1.dueOn })
        } else {
            invoices = result
        }
    }
}

extension InvoiceStatus {
    var tone: Pill.Tone {
        switch self {
        case .paid: return .success
        case .partial: return .warning
        case .unpaid: return .danger
        }
    }
}
