import Foundation
import Observation

/// The selected child's leave requests.
@Observable
@MainActor
final class LeaveViewModel {
    var requests: Loadable<[LeaveRequest]> = .loading
    var errorText: String?

    func load(repo: any Repository, childId: String) async {
        let result = await Loadable<[LeaveRequest]>.capture { try await repo.leaveRequests(childId: childId) }
        if let list = result.value {
            requests = .loaded(list.sorted { $0.createdAt > $1.createdAt })
        } else {
            requests = result
        }
    }

    func cancel(repo: any Repository, id: String, childId: String) async {
        errorText = nil
        do {
            _ = try await repo.cancelLeave(id: id)
            await load(repo: repo, childId: childId)
        } catch {
            errorText = error.localizedDescription
        }
    }
}

/// Form state for a new leave request. Dates are IST calendar strings ("2026-11-03").
@Observable
@MainActor
final class ApplyLeaveViewModel {
    var fromOn = IST.todayOn()
    var toOn = IST.todayOn()
    var half: LeaveHalf = .none
    var reason = ""
    var isSubmitting = false
    var errorText: String?

    var isSingleDay: Bool { fromOn == toOn }

    var canSubmit: Bool {
        !isSubmitting && !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Keeps the range valid: "to" never before "from", and a half day only for a single day.
    func fromChanged() {
        if toOn < fromOn { toOn = fromOn }
        if !isSingleDay { half = .none }
    }

    func toChanged() {
        if !isSingleDay { half = .none }
    }

    /// Returns true on success.
    func submit(repo: any Repository, childId: String) async -> Bool {
        if let problem = LeaveRules.validate(from: fromOn, to: toOn, half: half, reason: reason, today: IST.todayOn()) {
            errorText = problem.localizedDescription
            return false
        }
        isSubmitting = true
        errorText = nil
        defer { isSubmitting = false }
        do {
            _ = try await repo.applyLeave(childId: childId, from: fromOn, to: toOn, half: half, reason: reason)
            return true
        } catch {
            errorText = error.localizedDescription
            return false
        }
    }
}
