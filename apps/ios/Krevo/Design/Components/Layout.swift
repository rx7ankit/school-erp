import SwiftUI

/// Standard scrolling screen: white background, 20pt side gutters, generous spacing.
struct ScreenScroll<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) {
                content
            }
            .padding(.horizontal, 20)
            .padding(.top, Tokens.Space.s4)
            .padding(.bottom, Tokens.Space.s6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Tokens.bg.ignoresSafeArea())
    }
}

/// "Label ......... value" row used in detail screens.
struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
            Spacer(minLength: Tokens.Space.s3)
            Text(value).font(.sc(.callout, weight: .medium)).foregroundStyle(Tokens.text)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
    }
}

struct Separator: View {
    var body: some View {
        Rectangle().fill(Tokens.separator).frame(height: 0.5)
    }
}

/// Small grey section label.
struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.sc(.caption, weight: .semibold))
            .foregroundStyle(Tokens.textSecondary)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Tokens.Space.s2)
            .reveal()
    }
}

/// Centered empty message with a quiet icon.
struct EmptyNote: View {
    let text: String
    var systemImage = "tray"

    var body: some View {
        VStack(spacing: Tokens.Space.s3) {
            Image(systemName: systemImage)
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Tokens.textTertiary)
            Text(text)
                .font(.sc(.callout))
                .foregroundStyle(Tokens.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Tokens.Space.s6)
        .reveal()
    }
}
