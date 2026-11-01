import SwiftUI

/// Pushed from More. Read-only: fees are paid at the school office.
struct FeesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = FeesViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Fees.", grey: "Invoices for \(child.firstName).", role: .title1)

            LoadableView(vm.invoices, retry: { Task { await reload() } }) { list in
                if list.isEmpty {
                    EmptyNote(text: "No invoices yet.")
                }
                ForEach(list) { invoice in
                    NavigationLink(value: invoice) {
                        Card {
                            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                                HStack {
                                    Text(invoice.period).font(.sc(.body, weight: .semibold))
                                        .foregroundStyle(Tokens.text)
                                    Spacer()
                                    Pill(text: invoice.status.title, tone: invoice.status.tone)
                                }
                                Text(Money.format(paise: invoice.totalPaise))
                                    .font(.sc(.title2))
                                    .foregroundStyle(Tokens.text)
                                Text("\(invoice.no) - due \(IST.date(invoice.dueOn))")
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textSecondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Text("Pay at the school office.")
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s2)
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Invoice.self) { invoice in
            InvoiceDetailView(invoice: invoice)
        }
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }
}
