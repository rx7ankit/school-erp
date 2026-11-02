import SwiftUI

// All Liquid Glass / fallback logic for FLOATING chrome lives in this file.
// iOS 26+: real glass. iOS 17-25: .ultraThinMaterial with a hairline.
// Content cards never use this; they stay flat grey (see Card).

private struct ChromeSurfaceModifier<S: Shape>: ViewModifier {
    let shape: S
    let interactive: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            if interactive {
                content.glassEffect(.regular.interactive(), in: shape)
            } else {
                content.glassEffect(.regular, in: shape)
            }
        } else {
            content
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.stroke(Tokens.separator.opacity(0.6), lineWidth: 0.5))
        }
    }
}

extension View {
    /// Wrap floating chrome (child switcher, floating buttons) in glass or material.
    func chromeSurface<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        modifier(ChromeSurfaceModifier(shape: shape, interactive: interactive))
    }

    /// Capsule version (the default shape).
    func chromeSurface(interactive: Bool = false) -> some View {
        modifier(ChromeSurfaceModifier(shape: Capsule(), interactive: interactive))
    }

    /// Tab bar behaviour: on iOS 26 the system draws the glass bar and it minimises on scroll.
    @ViewBuilder
    func chromeTabBar() -> some View {
        if #available(iOS 26, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }
}

/// Groups nearby glass shapes so they blend (iOS 26); a plain pass-through before that.
struct ChromeGroup<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        if #available(iOS 26, *) {
            GlassEffectContainer(spacing: 12) { content }
        } else {
            content
        }
    }
}

/// Round floating icon button (e.g. the notification bell).
struct FloatingIconButton: View {
    let systemName: String
    let label: String
    var showsDot = false
    let action: () -> Void

    var body: some View {
        if #available(iOS 26, *) {
            Button(action: action) { icon }
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .accessibilityLabel(label)
        } else {
            Button(action: action) {
                icon
                    .frame(width: Tokens.Control.md, height: Tokens.Control.md)
                    .chromeSurface(in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
        }
    }

    private var icon: some View {
        Image(systemName: systemName)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(Tokens.text)
            .frame(minWidth: 24, minHeight: 24)
            .overlay(alignment: .topTrailing) {
                if showsDot {
                    Circle().fill(Tokens.danger).frame(width: 9, height: 9).offset(x: 3, y: -3)
                }
            }
    }
}
