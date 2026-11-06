import SwiftUI

/// One soft card holding a short list of rows with hairlines between them. Used for "needs your attention" and
/// settings-style lists, so several related things read as one block instead of a stack of boxes.
struct ListCard<Content: View>: View {
    private let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        VStack(spacing: 0) { content }
            .frame(maxWidth: .infinity)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
            .environment(\.revealContent, false)
            .reveal()
    }
}

/// A row inside a `ListCard`: a tinted icon, a title, an optional second line, and a chevron.
struct ListRow: View {
    let icon: String
    var tint: Color = Tokens.accent
    let title: String
    var subtitle: String? = nil
    var trailing: String? = nil
    var showsDivider = true
    var action: (() -> Void)? = nil

    var body: some View {
        let row = HStack(spacing: Tokens.Space.s3) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text).lineLimit(2).multilineTextAlignment(.leading)
                if let subtitle { Text(subtitle).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary).lineLimit(2).multilineTextAlignment(.leading) }
            }
            Spacer(minLength: Tokens.Space.s2)
            if let trailing { Text(trailing).font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text) }
            if action != nil {
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
            }
        }
        .padding(.horizontal, Tokens.Space.s4)
        .padding(.vertical, Tokens.Space.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) {
            if showsDivider { Separator().padding(.leading, Tokens.Space.s4 + 34 + Tokens.Space.s3) }
        }
        .contentShape(Rectangle())

        if let action {
            Button(action: action) { row }.buttonStyle(.pressable)
        } else {
            row
        }
    }
}

/// Thin progress bar in the brand colour.
struct BrandProgress: View {
    let fraction: Double
    var tint: Color = Tokens.accent
    var track: Color = Tokens.fill

    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule().fill(tint).frame(width: max(6, g.size.width * min(1, max(0, fraction))))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

/// A plain list row with no box around it: an icon, a title, an optional second line and a chevron, with a thin line
/// underneath. The quiet, document-like list used on More and the student list.
struct PlainRow<Leading: View>: View {
    let title: String
    var subtitle: String? = nil
    var showsChevron = true
    var showsDivider = true
    var inset: CGFloat = 0
    @ViewBuilder let leading: Leading

    var body: some View {
        HStack(spacing: Tokens.Space.s3) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text).lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary).lineLimit(1)
                }
            }
            Spacer(minLength: Tokens.Space.s2)
            if showsChevron {
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Tokens.textTertiary.opacity(0.8))
            }
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .bottom) { if showsDivider { Separator().padding(.leading, inset) } }
        .contentShape(Rectangle())
    }
}

/// A small grey heading above a group of plain rows.
struct GroupHeading: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textTertiary).textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Tokens.Space.s5)
            .padding(.bottom, Tokens.Space.s1)
    }
}
