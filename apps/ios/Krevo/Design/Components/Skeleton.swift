import SwiftUI

// Loading placeholders. Flat neutral grey (Tokens.fill) with a slow left-to-right shimmer.
// Shapes copy the real layout (same paddings, radii and line heights) so nothing jumps
// when the content swaps in.

// MARK: - Line heights

extension TextRole {
    /// Approximate height of one line of text in this role. Skeleton lines reserve exactly this much.
    var skeletonLineHeight: CGFloat {
        switch self {
        case .title1: return 48
        case .title2: return 34
        case .title3: return 25
        case .body: return 22
        case .callout: return 20
        case .caption: return 16
        }
    }
}

// MARK: - Block

/// Flat rounded rectangle with a soft shimmer. Static when Reduce Motion is on. No shadows.
struct SkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat = 14
    var radius: CGFloat = 6

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -0.8

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(Tokens.fill)
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [Tokens.bg.opacity(0), Tokens.bg.opacity(0.5), Tokens.bg.opacity(0)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.7, height: geo.size.height)
                    .offset(x: geo.size.width * phase)
                }
                .opacity(reduceMotion ? 0 : 1)
            )
            .clipShape(shape)
            .frame(width: width, height: height)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                    phase = 1.1
                }
            }
            .accessibilityHidden(true)
    }
}

/// Circle placeholder (avatars, icon badges).
struct SkeletonCircle: View {
    var size: CGFloat = 36

    var body: some View {
        SkeletonBlock(width: size, height: size, radius: size / 2)
    }
}

/// Capsule placeholder with the footprint of a `Pill`.
struct SkeletonPill: View {
    var width: CGFloat = 64

    var body: some View {
        SkeletonBlock(width: width, height: 26, radius: 13)
    }
}

/// One line of text. Reserves the full line height of `role`; the bar itself is a little shorter.
/// A nil width fills the available width.
struct SkeletonLine: View {
    var width: CGFloat? = nil
    var role: TextRole = .callout

    var body: some View {
        let lineHeight = role.skeletonLineHeight
        let block = SkeletonBlock(width: width, height: (lineHeight * 0.6).rounded(), radius: 5)
        if width == nil {
            block
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: lineHeight)
        } else {
            block
                .frame(height: lineHeight)
        }
    }
}

// MARK: - Accessibility + helpers

extension View {
    /// One "Loading" element for the whole skeleton instead of dozens of empty shapes.
    func skeletonAccessibility() -> some View {
        self
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(L.t("common.loading"))
    }

    /// Hides this view's content and draws a shimmering block of the same size while `active`.
    func skeleton(_ active: Bool, radius: CGFloat = 6) -> some View {
        self
            .opacity(active ? 0 : 1)
            .overlay {
                if active { SkeletonBlock(radius: radius) }
            }
            .accessibilityHidden(active)
    }
}

// MARK: - Appear (fade + slide up)

struct AppearModifier: ViewModifier {
    let index: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: (shown || reduceMotion) ? 0 : 10)
            .onAppear {
                guard !shown else { return }
                let delay = Double(min(max(index, 0), 8)) * 0.04
                withAnimation(.easeOut(duration: 0.45).delay(delay)) {
                    shown = true
                }
            }
    }
}

extension View {
    /// Soft fade in with a slight upward slide the first time the view appears.
    /// Pass `index` to stagger siblings by a small delay.
    func appear(index: Int = 0) -> some View {
        modifier(AppearModifier(index: index))
    }
}

// MARK: - Reveal (content-only appear after a load)

private struct RevealContentKey: EnvironmentKey {
    static let defaultValue: Bool = false
}

extension EnvironmentValues {
    /// True for views mounted by `LoadableView` after data arrived. Shared components
    /// (Card, TwoToneTitle, SectionLabel...) then fade/slide their own content in once,
    /// while shapes and backgrounds stay still. `Card` resets it to false for its children.
    var revealContent: Bool {
        get { self[RevealContentKey.self] }
        set { self[RevealContentKey.self] = newValue }
    }
}

struct RevealModifier: ViewModifier {
    let index: Int
    @Environment(\.revealContent) private var reveal

    @ViewBuilder
    func body(content: Content) -> some View {
        if reveal {
            content.appear(index: index)
        } else {
            content
        }
    }
}

extension View {
    /// Applies `appear(index:)` only when mounted right after a load (see `revealContent`).
    func reveal(index: Int = 0) -> some View {
        modifier(RevealModifier(index: index))
    }
}

// MARK: - Ready-made shapes

/// Placeholder card: same fill, radius and padding as `Card`.
struct SkeletonCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Tokens.Space.s4)
            .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
    }
}

/// Card holding a few text lines. The last line is shorter.
struct SkeletonTextCard: View {
    var lines: Int = 3
    var role: TextRole = .callout

    var body: some View {
        SkeletonCard {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                ForEach(0..<max(lines, 1), id: \.self) { i in
                    SkeletonLine(width: i == lines - 1 && lines > 1 ? 160 : nil, role: role)
                }
            }
        }
        .skeletonAccessibility()
    }
}

/// Avatar, two lines and a trailing pill, in a card (or bare with `card: false`).
struct SkeletonRow: View {
    var card: Bool = true

    var body: some View {
        if card {
            SkeletonCard { rowContent }
                .skeletonAccessibility()
        } else {
            rowContent.skeletonAccessibility()
        }
    }

    private var rowContent: some View {
        HStack(spacing: Tokens.Space.s3) {
            SkeletonCircle(size: 44)
            VStack(alignment: .leading, spacing: 2) {
                SkeletonLine(width: 150, role: .body)
                SkeletonLine(width: 110, role: .callout)
            }
            Spacer(minLength: Tokens.Space.s2)
            SkeletonPill(width: 60)
        }
    }
}

/// A grid of small stat tiles (value + caption), each in a card.
struct SkeletonStatGrid: View {
    var count: Int = 4
    var columns: Int = 2

    var body: some View {
        let cols = max(columns, 1)
        let rowCount = (max(count, 1) + cols - 1) / cols
        VStack(spacing: Tokens.Space.s3) {
            ForEach(0..<rowCount, id: \.self) { _ in
                HStack(spacing: Tokens.Space.s3) {
                    ForEach(0..<cols, id: \.self) { _ in
                        SkeletonCard {
                            VStack(alignment: .leading, spacing: 2) {
                                SkeletonLine(width: 44, role: .title3)
                                SkeletonLine(width: 72, role: .caption)
                            }
                        }
                    }
                }
            }
        }
        .skeletonAccessibility()
    }
}

/// A column of `SkeletonRow`s. Default placeholder for any list.
struct SkeletonList: View {
    var rows: Int = 4

    var body: some View {
        VStack(spacing: Tokens.Space.s4) {
            ForEach(0..<max(rows, 1), id: \.self) { _ in
                SkeletonRow()
            }
        }
        .skeletonAccessibility()
    }
}
