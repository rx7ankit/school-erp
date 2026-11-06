import SwiftUI

/// A grid of orange dots that is strongest at the top edge and dissolves towards the bottom, in the style of
/// Cloudflare's hero art. Each dot has a thin white ring so it reads as a bead, not a speck.
/// Purely decorative: it takes no taps and is hidden from VoiceOver.
struct DotMatrix: View {
    var height: CGFloat = 300
    var spacing: CGFloat = 13
    var radius: CGFloat = 2.1

    var body: some View {
        ZStack(alignment: .top) {
            // A faint warm glow behind the dots gives the top some depth.
            RadialGradient(colors: [Tokens.accent.opacity(0.16), .clear], center: .top, startRadius: 0, endRadius: height * 0.95)
            Canvas { ctx, size in
                let cols = Int(size.width / spacing) + 2
                let rows = Int(size.height / spacing) + 1
                let xInset = (size.width - CGFloat(cols - 1) * spacing) / 2
                for r in 0..<rows {
                    let y = CGFloat(r) * spacing + spacing / 2
                    let t = y / size.height                       // 0 at the top, 1 at the bottom
                    let fade = pow(max(0, 1 - t), 1.6)
                    for c in 0..<cols {
                        let h = Self.hash(r, c)
                        // Dots drop out more and more as the rows go down, so the edge dissolves instead of banding.
                        if h > fade * 1.5 + 0.06 { continue }
                        let x = xInset + CGFloat(c) * spacing
                        // Brightness varies a little per dot; orange at the top turns to peach lower down.
                        let strength = fade * (0.55 + 0.45 * Self.hash(c, r + 91))
                        let tone = Color(red: 0.95, green: 0.42 + 0.30 * t, blue: 0.11 + 0.32 * t)
                        let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
                        let dot = Path(ellipseIn: rect)
                        ctx.fill(dot, with: .color(tone.opacity(0.18 + 0.82 * strength)))
                        ctx.stroke(dot, with: .color(.white.opacity(0.55 * (0.4 + strength))), lineWidth: 0.8)
                    }
                }
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// A repeatable pseudo-random number in 0...1 for a grid cell.
    private static func hash(_ a: Int, _ b: Int) -> Double {
        var x = UInt64(truncatingIfNeeded: a &* 73856093 ^ b &* 19349663)
        x = (x ^ (x >> 15)) &* 0x2C1B3C6D
        x = (x ^ (x >> 12)) &* 0x297A2D39
        x ^= x >> 15
        return Double(x % 10_000) / 10_000
    }
}
