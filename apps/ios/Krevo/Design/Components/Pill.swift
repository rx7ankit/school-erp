import SwiftUI

/// Small rounded label: subject chips, status badges.
struct Pill: View {
    enum Tone {
        case neutral, accent, success, warning, danger
    }

    let text: String
    var tone: Tone = .neutral
    var systemImage: String? = nil

    private var foreground: Color {
        switch tone {
        case .neutral: return Tokens.textSecondary
        case .accent: return Tokens.text
        case .success: return Tokens.success
        case .warning: return Tokens.warning
        case .danger: return Tokens.danger
        }
    }

    private var background: Color {
        switch tone {
        case .neutral: return Tokens.fill
        case .accent: return Tokens.fill
        case .success: return Tokens.success.opacity(0.14)
        case .warning: return Tokens.warning.opacity(0.14)
        case .danger: return Tokens.danger.opacity(0.14)
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            if let systemImage {
                Image(systemName: systemImage).font(.system(size: 11, weight: .semibold))
            }
            Text(text).font(.sc(.caption, weight: .semibold))
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(background, in: Capsule())
    }
}

typealias Badge = Pill
