import SwiftUI

/// Pushed from More. Read-only: fees are paid at the school office.
struct FeesView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = FeesViewModel()

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("fees.ink"), grey: L.f("fees.grey", child.firstName), role: .title1)

            LoadableView(vm.invoices, retry: { Task { await reload() } }, skeleton: {
                VStack(spacing: Tokens.Space.s4) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonCard {
                            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                                HStack {
                                    SkeletonLine(width: 130, role: .body)
                                    Spacer()
                                    SkeletonPill(width: 64)
                                }
                                SkeletonLine(width: 110, role: .title2)
                                SkeletonLine(width: 200, role: .callout)
                            }
                        }
                    }
                }
            }) { list in
                if list.isEmpty {
                    EmptyNote(text: L.t("fees.empty"))
                }
                ForEach(list) { invoice in
                    // A destination link, not a value link: Fees is pushed by More's typed path, which cannot hold an Invoice
                    // value, so a value link did nothing.
                    NavigationLink {
                        InvoiceDetailView(invoice: invoice, child: child)
                            .hidesTabBar()
                    } label: {
                        Card {
                            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                                HStack {
                                    Text(invoice.periodTitle).font(.sc(.body, weight: .semibold))
                                        .foregroundStyle(Tokens.text)
                                    Spacer()
                                    Pill(text: invoice.status.title, tone: invoice.status.tone)
                                }
                                Text(Money.format(paise: invoice.totalPaise))
                                    .font(.sc(.title2))
                                    .foregroundStyle(Tokens.text)
                                Text(L.f("fees.due_fmt", invoice.no, IST.date(invoice.dueOn)))
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textSecondary)
                            }
                        }
                    }
                    .buttonStyle(.pressable)
                }
            }

            Text(L.t("fees.pay_office"))
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s2)
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }
}
