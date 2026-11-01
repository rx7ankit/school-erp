import SwiftUI

struct InvoiceDetailView: View {
    let invoice: Invoice

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: invoice.period, grey: invoice.no, role: .title1)

            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: "Status", value: invoice.status.title)
                    InfoRow(label: "Due date", value: IST.date(invoice.dueOn))
                    InfoRow(label: "Total", value: Money.format(paise: invoice.totalPaise))
                    InfoRow(label: "Paid", value: Money.format(paise: invoice.paidPaise))
                    InfoRow(label: "Balance", value: Money.format(paise: invoice.duePaise))
                }
            }

            SectionLabel("Line items")
            Card {
                VStack(spacing: Tokens.Space.s3) {
                    ForEach(invoice.lines) { line in
                        InfoRow(label: line.title, value: Money.format(paise: line.amountPaise))
                    }
                }
            }

            SectionLabel("Receipts")
            if invoice.payments.isEmpty {
                Card {
                    Text("No payments received yet.")
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
            }
            ForEach(invoice.payments) { payment in
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        HStack {
                            Text(Money.format(paise: payment.amountPaise))
                                .font(.sc(.title3))
                                .foregroundStyle(Tokens.text)
                            Spacer()
                            Pill(text: payment.mode, tone: .neutral)
                        }
                        Text("Receipt \(payment.receiptNo)")
                            .font(.sc(.callout, weight: .medium))
                            .foregroundStyle(Tokens.text)
                        Text("\(IST.dateTime(payment.at)) IST")
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }

            Text("Pay at the school office.")
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s2)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
