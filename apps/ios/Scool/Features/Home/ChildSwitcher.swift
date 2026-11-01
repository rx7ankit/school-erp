import SwiftUI

/// Floating pill, top-left of Home: avatar + first name + chevron.
/// Opens a sheet listing all children. No chevron / not tappable with one child.
struct ChildSwitcher: View {
    let selected: Child
    let children: [Child]
    let onSelect: (Child) -> Void

    @State private var showSheet = false

    private var canSwitch: Bool { children.count > 1 }

    var body: some View {
        Button {
            if canSwitch { showSheet = true }
        } label: {
            HStack(spacing: Tokens.Space.s2) {
                Avatar(name: selected.name, size: 28)
                Text(selected.firstName)
                    .font(.sc(.callout, weight: .semibold))
                    .lineLimit(1)
                if canSwitch {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .bold))
                }
            }
            .foregroundStyle(Tokens.text)
            .padding(.leading, 8)
            .padding(.trailing, canSwitch ? 14 : 16)
            .frame(minHeight: Tokens.Control.md)
            .chromeSurface(interactive: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(canSwitch ? "Child: \(selected.name). Double tap to switch child." : "Child: \(selected.name)")
        .sheet(isPresented: $showSheet) {
            ChildPickerSheet(selected: selected, children: children) { child in
                onSelect(child)
                showSheet = false
            }
            .presentationDetents([.medium])
        }
    }
}

struct ChildPickerSheet: View {
    let selected: Child
    let children: [Child]
    let onPick: (Child) -> Void

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Switch child.", grey: "The whole app follows your choice.")
                .padding(.top, Tokens.Space.s4)

            ForEach(children) { child in
                Button {
                    onPick(child)
                } label: {
                    Card {
                        HStack(spacing: Tokens.Space.s3) {
                            Avatar(name: child.name, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(child.name).font(.sc(.body, weight: .semibold))
                                Text("Class \(child.classLabel)")
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textSecondary)
                            }
                            Spacer()
                            if child.id == selected.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Tokens.accent)
                            }
                        }
                        .foregroundStyle(Tokens.text)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityValue(child.id == selected.id ? "Selected" : "")
            }
        }
    }
}
