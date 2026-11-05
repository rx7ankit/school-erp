import SwiftUI

struct InvoiceDetailView: View {
    let invoice: Invoice
    let child: Child

    @State private var shared: SharedFile?
    @State private var receiptError = false

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: invoice.periodTitle, grey: "", role: .title1)

            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: L.t("common.status"), value: invoice.status.title)
                    InfoRow(label: L.t("fees.due_date"), value: IST.date(invoice.dueOn))
                }
            }

            SectionLabel(L.t("fees.line_items"))
            Card {
                VStack(spacing: Tokens.Space.s3) {
                    ForEach(invoice.lines) { line in
                        InfoRow(label: L.known("line", line.title), value: Money.formatSigned(paise: line.amountPaise))
                    }
                    Separator()
                    HStack {
                        Text(L.t("results.total")).font(.sc(.body, weight: .bold)).foregroundStyle(Tokens.text)
                        Spacer()
                        Text(Money.format(paise: invoice.totalPaise))
                            .font(.sc(.body, weight: .bold))
                            .foregroundStyle(Tokens.text)
                    }
                    .accessibilityElement(children: .combine)
                    InfoRow(label: L.t("fees.paid"), value: Money.format(paise: invoice.paidPaise))
                    InfoRow(label: L.t("fees.balance"), value: Money.format(paise: invoice.duePaise))
                }
            }

            SectionLabel(L.t("fees.payments"))
            if invoice.payments.isEmpty {
                Card {
                    Text(L.t("fees.no_payments"))
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
            }
            ForEach(invoice.payments) { payment in
                paymentCard(payment)
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

    /// A cancelled payment is struck through, labelled, and has no receipt button.
    private func paymentCard(_ payment: Payment) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack {
                    Text(Money.format(paise: payment.amountPaise))
                        .font(.sc(.title3))
                        .strikethrough(!payment.isActive)
                        .foregroundStyle(payment.isActive ? Tokens.text : Tokens.textTertiary)
                    Spacer()
                    if payment.isActive {
                        Pill(text: payment.modeTitle, tone: .neutral)
                    } else {
                        Pill(text: L.t("fees.cancelled"), tone: .danger)
                    }
                }
                Text(L.f("fees.receipt_no", payment.receiptNo))
                    .font(.sc(.callout, weight: .medium))
                    .strikethrough(!payment.isActive)
                    .foregroundStyle(payment.isActive ? Tokens.text : Tokens.textTertiary)
                Text("\(payment.modeTitle) - \(payment.reference)")
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textSecondary)
                Text("\(IST.dateTime(payment.at)) IST")
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textSecondary)
                if payment.isActive {
                    Button {
                        download(payment)
                    } label: {
                        Label(L.t("fees.download"), systemImage: "arrow.down.doc")
                            .font(.sc(.callout, weight: .semibold))
                            .foregroundStyle(Tokens.text)
                            .frame(minHeight: Tokens.Control.md)
                    }
                    .buttonStyle(.pressable)
                }
            }
        }
        .accessibilityElement(children: payment.isActive ? .contain : .combine)
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
