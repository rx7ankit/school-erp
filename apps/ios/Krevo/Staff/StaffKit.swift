import SwiftUI
import Observation

/// Small helpers shared by every staff screen, so each screen stays a plain view plus one load call.

/// Holds one screen's data as a `Loadable`. Keeps showing the old content while it refreshes.
@Observable
@MainActor
final class Loader<T> {
    var state: Loadable<T> = .idle

    func load(_ work: @escaping () async throws -> T) async {
        if state.value == nil { state = .loading }
        let result = await Loadable.capture(work)
        // A failed refresh keeps what was already on screen.
        if case .failed = result, state.value != nil { return }
        state = result
    }

    func set(_ value: T) { state = .loaded(value) }
}

extension View {
    /// Breathing room for content inside a bottom sheet: clear of the grabber on top, and of the rounded
    /// corners and home indicator at the bottom, with slightly wider side gutters than a full screen.
    func sheetPadding() -> some View {
        self
            .safeAreaInset(edge: .top, spacing: 0) { Color.clear.frame(height: Tokens.Space.s4) }
            .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: Tokens.Space.s4) }
            .padding(.horizontal, Tokens.Space.s1)
    }
}

/// "Hi, Sunita." style headline used at the top of staff tabs.
struct StaffHeader: View {
    let ink: String
    let grey: String
    var body: some View {
        TwoToneTitle(ink: ink, grey: grey, role: .title1)
    }
}

/// A number with a caption, on a flat card.
struct StatTile: View {
    let label: String
    let value: String
    var hint: String? = nil
    var tone: Pill.Tone? = nil

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.sc(.caption, weight: .semibold)).foregroundStyle(Tokens.textSecondary).textCase(.uppercase)
                Text(value).font(.sc(.title2)).foregroundStyle(tone == .danger ? Tokens.danger : Tokens.text).minimumScaleFactor(0.7).lineLimit(1)
                if let hint {
                    Text(hint).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary).lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// Plain rounded search field in the app's grey style.
struct SearchField: View {
    let prompt: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: Tokens.Space.s2) {
            Image(systemName: "magnifyingglass").foregroundStyle(Tokens.textTertiary)
            TextField(prompt, text: $text)
                .font(.sc(.body))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Tokens.textTertiary) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, Tokens.Space.s4)
        .frame(minHeight: Tokens.Control.md)
        .background(Tokens.card, in: Capsule())
    }
}

/// Row of selectable chips (filters and segments).
struct ChipRow<ID: Hashable>: View {
    let options: [(id: ID, title: String)]
    @Binding var selection: ID

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Tokens.Space.s2) {
                ForEach(options, id: \.id) { option in
                    let on = option.id == selection
                    Button { selection = option.id } label: {
                        Text(option.title)
                            .font(.sc(.callout, weight: .semibold))
                            .foregroundStyle(on ? Tokens.onSolid : Tokens.text)
                            .padding(.horizontal, 14)
                            .frame(minHeight: Tokens.Control.sm + 4)
                            .background(on ? Tokens.solid : Tokens.card, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
    }
}

/// A tappable phone number.
struct CallButton: View {
    let phone: String
    var body: some View {
        Link(destination: URL(string: "tel:" + phone.filter { $0.isNumber || $0 == "+" }) ?? URL(string: "tel:0")!) {
            Image(systemName: "phone.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Tokens.text)
                .frame(width: Tokens.Control.sm + 4, height: Tokens.Control.sm + 4)
                .background(Tokens.fill, in: Circle())
        }
        .accessibilityLabel("Call \(phone)")
    }
}

extension Text {
    /// Time like "08:40:00" shown as "8:40 am".
    static func clock(_ hhmmss: String) -> String {
        let parts = hhmmss.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]) else { return hhmmss }
        let h12 = h % 12 == 0 ? 12 : h % 12
        return "\(h12):\(parts[1]) \(h < 12 ? "am" : "pm")"
    }
}

func plainDate(_ on: String) -> String { IST.date(on) }
func rupees(_ paise: Int) -> String { Money.format(paise: paise) }
func percent(_ value: Double?) -> String { value.map { String(format: "%.1f%%", $0) } ?? "–" }
