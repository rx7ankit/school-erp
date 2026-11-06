import SwiftUI

/// The Library tab: how many books are out, what is overdue, and a searchable catalogue. Issuing and returning
/// are done on the web for now. Only for whoever holds the Library permission.
struct StaffLibraryView: View {
    @Environment(StaffContext.self) private var context
    @State private var summary = Loader<LibrarySummary>()
    @State private var overdue: [LibraryLoan] = []
    @State private var books: [LibraryBook] = []
    @State private var total = 0
    @State private var query = ""
    @State private var loading = true
    @State private var loadingMore = false

    var body: some View {
        NavigationStack {
            ScreenScroll {
                LoadableView(summary.state, retry: { Task { await reload() } }, skeleton: { SkeletonBlock(height: 84, radius: 22) }) { s in
                    HStack(spacing: Tokens.Space.s3) {
                        stat("Books", "\(s.books)")
                        stat("On loan", "\(s.onLoan)")
                        stat("Overdue", "\(s.overdue)", tone: s.overdue > 0 ? Tokens.danger : Tokens.text)
                    }
                }

                SearchField(prompt: "Search title, author or ISBN", text: $query)

                if query.isEmpty && !overdue.isEmpty {
                    GroupHeading("Overdue")
                    PlainList(items: overdue) { loan, last in
                        PlainLine(showsDivider: !last) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(loan.title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text).lineLimit(1)
                                Text("\(loan.borrower) · \(loan.daysOverdue) \(loan.daysOverdue == 1 ? "day" : "days") late · due \(IST.date(loan.dueOn))")
                                    .font(.sc(.callout)).foregroundStyle(Tokens.danger)
                            }
                        }
                    }
                }

                GroupHeading(query.isEmpty ? "Books" : "Results")
                if loading && books.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.vertical, Tokens.Space.s5)
                } else if books.isEmpty {
                    EmptyNote(text: "No books found.", systemImage: "books.vertical")
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(books.enumerated()), id: \.element.id) { i, b in
                            PlainLine(showsDivider: i < books.count - 1) {
                                HStack(spacing: Tokens.Space.s3) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(b.title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text).lineLimit(1)
                                        Text([b.author, b.category].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                            .font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(1)
                                    }
                                    Spacer(minLength: Tokens.Space.s2)
                                    Text("\(b.available)/\(b.copiesTotal)").font(.sc(.callout, weight: .semibold))
                                        .foregroundStyle(b.available == 0 ? Tokens.danger : Tokens.text).monospacedDigit()
                                }
                            }
                            .task { if b.id == books.last?.id { await more() } }
                        }
                        if loadingMore { ProgressView().frame(maxWidth: .infinity).padding() }
                    }
                }
            }
            .refreshable { await reload() }
            .toolbar(.hidden, for: .navigationBar)
            .task(id: query) {
                if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
                if Task.isCancelled { return }
                await reload()
            }
        }
    }

    private func stat(_ label: String, _ value: String, tone: Color = Tokens.text) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(tone).monospacedDigit()
        }
        .padding(Tokens.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func reload() async {
        async let s: () = summary.load { try await context.repo.librarySummary() }
        async let o = try? await context.repo.overdueLoans(offset: 0)
        do {
            let page = try await context.repo.books(query: query, offset: 0)
            books = page.items; total = page.total
        } catch { if !(error is CancellationError) { books = [] } }
        loading = false
        _ = await s
        overdue = Array((await o)?.items.prefix(5) ?? [])
    }

    private func more() async {
        guard !loadingMore, books.count < total else { return }
        loadingMore = true
        if let page = try? await context.repo.books(query: query, offset: books.count) {
            books += page.items.filter { new in !books.contains { $0.id == new.id } }
        }
        loadingMore = false
    }
}
