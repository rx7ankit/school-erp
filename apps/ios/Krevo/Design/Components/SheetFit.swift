import SwiftUI

private struct SheetHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

extension View {
    /// Writes this view's natural height into `height` whenever it changes.
    func measuredHeight(_ height: Binding<CGFloat>) -> some View {
        background(GeometryReader { Color.clear.preference(key: SheetHeightKey.self, value: $0.size.height) })
            .onPreferenceChange(SheetHeightKey.self) { height.wrappedValue = $0 }
    }

    /// Makes a sheet exactly as tall as its content, so nothing is left empty under the last control.
    func fitSheet() -> some View { modifier(FitSheet()) }
}

private struct FitSheet: ViewModifier {
    @State private var height: CGFloat = 0

    func body(content: Content) -> some View {
        content
            // The content brings its own bottom padding, so the sheet's home-indicator inset is not added on top of it.
            .ignoresSafeArea(.container, edges: .bottom)
            .measuredHeight($height)
            .presentationDetents([.height(max(height, 160))])
            .presentationDragIndicator(.visible)
    }
}

/// Scrolling content for a sheet. The sheet is as tall as the content; if the content is taller than most of the
/// screen it stops there and scrolls, and can be pulled up to full height.
struct SheetScroll<Content: View>: View {
    private let content: Content
    @State private var height: CGFloat = 0

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        let cap = UIScreen.main.bounds.height * 0.8
        ScrollView {
            VStack(alignment: .leading, spacing: Tokens.Space.s4) { content }
                .padding(.horizontal, 20)
                .padding(.top, Tokens.Space.s6)
                .padding(.bottom, Tokens.Space.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .measuredHeight($height)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Tokens.bg.ignoresSafeArea())
        .presentationDetents(height > cap ? [.height(cap), .large] : [.height(max(height, 160))])
        .presentationDragIndicator(.visible)
    }
}
