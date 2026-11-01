import SwiftUI

struct InvoiceDetailView: View {
    let invoice: Invoice
    let child: Child

    @State private var shared: SharedFile?
    @State private var receiptError = false

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: invoice.periodTitle, grey: invoice.no, role: .title1)

            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: L.t("common.status"), value: invoice.status.title)
                    InfoRow(label: L.t("fees.due_date"), value: IST.date(invoice.dueOn))
                    InfoRow(label: L.t("results.total"), value: Money.format(paise: invoice.totalPaise))
                    InfoRow(label: L.t("fees.paid"), value: Money.format(paise: invoice.paidPaise))
                    InfoRow(label: L.t("fees.balance"), value: Money.format(paise: invoice.duePaise))
                }
            }

            SectionLabel(L.t("fees.line_items"))
            Card {
                VStack(spacing: Tokens.Space.s3) {
                    ForEach(invoice.lines) { line in
                        InfoRow(label: L.known("line", line.title), value: Money.format(paise: line.amountPaise))
                    }
                }
            }

            SectionLabel(L.t("fees.receipts"))
            if invoice.payments.isEmpty {
                Card {
                    Text(L.t("fees.no_payments"))
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
                            Pill(text: payment.modeTitle, tone: .neutral)
                        }
                        Text(L.f("fees.receipt_no", payment.receiptNo))
                            .font(.sc(.callout, weight: .medium))
                            .foregroundStyle(Tokens.text)
                        Text("\(IST.dateTime(payment.at)) IST")
                            .font(.sc(.caption))
                            .foregroundStyle(Tokens.textSecondary)
                        Button {
                            download(payment)
                        } label: {
                            Label(L.t("fees.download"), systemImage: "arrow.down.doc")
                                .font(.sc(.callout, weight: .semibold))
                                .foregroundStyle(Tokens.text)
                                .frame(minHeight: Tokens.Control.md)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Text(L.t("fees.pay_office"))
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.top, Tokens.Space.s2)
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $shared) { file in
            ShareSheet(url: file.url)
        }
        .alert(L.t("fees.receipt_error"), isPresented: $receiptError) {
            Button(L.t("common.ok"), role: .cancel) {}
        }
    }

    /// Builds the A5 PDF and opens the system share/save sheet.
    private func download(_ payment: Payment) {
        if let url = ReceiptPDF.make(child: child, invoice: invoice, payment: payment) {
            shared = SharedFile(url: url)
        } else {
            receiptError = true
        }
    }
}
