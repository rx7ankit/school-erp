import SwiftUI

/// Leave requests from parents. A class teacher (or admin) approves or rejects pending ones.
struct StaffLeaveView: View {
    @Environment(StaffContext.self) private var context
    @State private var filter = "pending"
    @State private var list = Loader<[StaffLeave]>()
    @State private var picked: StaffLeave?

    var body: some View {
        NavigationStack {
            ScreenScroll {
                StaffHeader(ink: "Leave.", grey: "Requests from parents.")
                ChipRow(options: [(id: "pending", title: "Pending"), (id: "approved", title: "Approved"), (id: "rejected", title: "Rejected")], selection: $filter)

                LoadableView(list.state, retry: { Task { await load() } }) { rows in
                    if rows.isEmpty { EmptyNote(text: filter == "pending" ? "Nothing waiting for you." : "No \(filter) requests.") }
                    ForEach(rows) { leave in
                        Button { picked = leave } label: { row(leave) }.buttonStyle(.pressable)
                    }
                }
            }
            .refreshable { await load() }
            .toolbar(.hidden, for: .navigationBar)
            .task(id: filter) { list.state = .loading; await load() }
            .sheet(item: $picked) { leave in
                StaffLeaveDetail(leave: leave) { _ in
                    picked = nil
                    Task { await load(); await context.refreshPendingLeaves() }
                }
                .sheetPadding()
                .presentationDetents([.fraction(0.8), .large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    private func row(_ l: StaffLeave) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Text(l.studentName).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                    Spacer()
                    Pill(text: l.status.capitalized, tone: l.status == "approved" ? .success : (l.status == "rejected" ? .danger : .warning))
                }
                Text([l.classLabel.map { "Class \($0)" }, IST.dateRange(from: l.fromOn, to: l.toOn)].compactMap { $0 }.joined(separator: " · "))
                    .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                Text(l.reason).font(.sc(.callout)).foregroundStyle(Tokens.text).lineLimit(2)
            }
        }
    }

    private func load() async { await list.load { try await context.repo.leaves(status: filter) } }
}

private struct StaffLeaveDetail: View {
    let leave: StaffLeave
    let done: (StaffLeave) -> Void

    @Environment(StaffContext.self) private var context
    @State private var note = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScreenScroll {
            Text(leave.studentName).font(.sc(.title2))
            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: "Class", value: leave.classLabel ?? "–")
                    InfoRow(label: "Dates", value: IST.dateRange(from: leave.fromOn, to: leave.toOn))
                    if leave.half != "full" { InfoRow(label: "Half", value: leave.half.capitalized) }
                    InfoRow(label: "Requested by", value: leave.guardianName)
                    InfoRow(label: "Sent", value: IST.dateTime(leave.createdAt))
                }
            }
            Card { Text(leave.reason).font(.sc(.body)) }

            if leave.status == "pending" {
                AppField(title: "Note to parent (optional)", text: $note)
                if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
                PrimaryButton(title: "Approve", style: .brand, isLoading: busy) { Task { await decide(true) } }
                PrimaryButton(title: "Reject", style: .solid, isEnabled: !busy) { Task { await decide(false) } }
            } else {
                Pill(text: leave.status.capitalized, tone: leave.status == "approved" ? .success : .danger)
                if let by = leave.decidedByName { Text("Decided by \(by)").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }
                if let n = leave.decisionNote { Text("“\(n)”").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }
            }
        }
    }

    private func decide(_ approve: Bool) async {
        busy = true
        error = nil
        do { done(try await context.repo.decideLeave(id: leave.id, approve: approve, note: note)) }
        catch { self.error = error.localizedDescription }
        busy = false
    }
}
