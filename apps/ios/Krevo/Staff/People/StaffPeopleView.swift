import SwiftUI

/// People & access: who is on staff, what each person can do, and logins. Opens from the picture on Home, only for whoever
/// holds the People & access permission.
struct StaffPeopleView: View {
    @Environment(StaffContext.self) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var list = Loader<[StaffMember]>()
    @State private var options: AccessOptions?
    @State private var adding = false

    var body: some View {
        ScreenScroll {
            SearchField(prompt: "Search by name", text: $query)
            LoadableView(list.state, retry: { Task { await load() } }) { rows in
                if rows.isEmpty { EmptyNote(text: "No one found.") }
                PlainList(items: rows) { m, last in
                    NavigationLink(value: m) {
                        PlainRow(title: m.name, subtitle: summary(m), showsDivider: !last, inset: 52,
                                 accessory: (m.inviteStatus ?? "") != "active" && m.isActive ? AnyView(Pill(text: "Not signed in", tone: .warning)) : nil) {
                            Avatar(name: m.name, size: 40)
                        }
                    }
                    .buttonStyle(.pressable)
                }
            }
        }
        .navigationTitle("People & access")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { adding = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add a person")
            }
        }
        .task(id: query) {
            if !query.isEmpty { try? await Task.sleep(for: .milliseconds(300)) }
            if !Task.isCancelled { await load() }
        }
        .task { options = try? await context.repo.accessOptions() }
        .navigationDestination(for: StaffMember.self) { m in
            StaffPersonView(member: m, options: options) { Task { await load() } }
        }
        .sheet(isPresented: $adding) {
            StaffAddPersonView(options: options) { adding = false; Task { await load() } }
        }
    }

    private func summary(_ m: StaffMember) -> String {
        let perms = Set(m.permissions ?? []).intersection(StaffAccess.all)
        // A plain teacher has no extra access, so only their designation shows; anything extra is named.
        let access = perms.count == StaffAccess.all.count ? "Full access"
            : perms.isEmpty ? ""
            : perms.sorted().map { $0.replacingOccurrences(of: ".manage", with: "").capitalized }.joined(separator: ", ")
        return [m.designation, access].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private func load() async { await list.load { try await context.repo.staff(query: query) } }
}

/// One person: their access as switches (one per permission), Save in the top bar, and their login.
struct StaffPersonView: View {
    let member: StaffMember
    let options: AccessOptions?
    let changed: () -> Void

    @Environment(StaffContext.self) private var context
    @State private var selected: Set<String>
    @State private var busy = false
    @State private var message: String?
    @State private var failed = false

    init(member: StaffMember, options: AccessOptions?, changed: @escaping () -> Void) {
        self.member = member; self.options = options; self.changed = changed
        _selected = State(initialValue: Set(member.permissions ?? []).intersection(StaffAccess.all))
    }

    private var dirty: Bool { selected != Set(member.permissions ?? []).intersection(StaffAccess.all) }

    var body: some View {
        ScreenScroll {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: member.name, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(member.name).font(.sc(.title3)).foregroundStyle(Tokens.text)
                    Text([member.designation, member.email].filter { !$0.isEmpty }.joined(separator: " · ")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            }

            if let options {
                GroupHeading("Access")
                VStack(spacing: 0) {
                    ForEach(Array(options.permissions.enumerated()), id: \.element.id) { i, p in
                        PlainLine(showsDivider: i < options.permissions.count - 1) {
                            Toggle(isOn: Binding(get: { selected.contains(p.key) }, set: { on in if on { selected.insert(p.key) } else { selected.remove(p.key) } })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.label).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                    Text(p.description).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                }
                            }
                            .tint(Tokens.accent)
                        }
                    }
                }
            }

            if let message { Text(message).font(.sc(.callout)).foregroundStyle(failed ? Tokens.danger : Tokens.success) }

            if (member.inviteStatus ?? "") != "active" && member.isActive {
                Button("Send login by email") { Task { await sendLogin() } }
                    .font(.sc(.callout, weight: .semibold)).foregroundStyle(Tokens.text).frame(minHeight: Tokens.Control.md)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        // Save sits at the top right, on the same row as the back button, and stays there while you scroll.
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if busy {
                    ProgressView()
                } else {
                    Button("Save") { Task { await save() } }
                        .font(.sc(.body, weight: .semibold))
                        .disabled(!dirty)
                }
            }
        }
    }

    private func save() async {
        busy = true; message = nil
        defer { busy = false }
        do {
            _ = try await context.repo.setPermissions(staffId: member.id, permissions: selected.sorted())
            failed = false; message = "Saved."
            Haptics.success()
            changed()
            // Their own access may have changed: reload who I am and what my app shows.
            if member.id == context.me.id { await context.refreshMe(); await context.loadLayout() }
        } catch {
            failed = true; message = (error as? ApiError)?.message ?? "That could not be saved. Try again."
            Haptics.error()
        }
    }

    private func sendLogin() async {
        failed = false
        do { try await context.repo.sendLogin(staffId: member.id); message = "Login sent." }
        catch { failed = true; message = (error as? ApiError)?.message ?? "The login could not be sent." }
    }
}

/// A new person: name, email, designation, and a starting preset for their access.
struct StaffAddPersonView: View {
    let options: AccessOptions?
    let done: () -> Void

    @Environment(StaffContext.self) private var context
    @State private var name = ""
    @State private var email = ""
    @State private var designation = "Teacher"
    @State private var permissions: Set<String> = []
    @State private var sendLogin = true
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScreenScroll {
            Text("Add a person").font(.sc(.title2))
            AppField(title: "Name", text: $name)
            AppField(title: "Email", text: $email, keyboard: .emailAddress)
            AppField(title: "Designation", text: $designation)
            if let options {
                GroupHeading("Access")
                VStack(spacing: 0) {
                    ForEach(Array(options.permissions.enumerated()), id: \.element.id) { i, p in
                        PlainLine(showsDivider: i < options.permissions.count - 1) {
                            Toggle(isOn: Binding(get: { permissions.contains(p.key) }, set: { on in if on { permissions.insert(p.key) } else { permissions.remove(p.key) } })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(p.label).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                    Text(p.description).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                }
                            }
                            .tint(Tokens.accent)
                        }
                    }
                }
            }
            Toggle("Email their login now", isOn: $sendLogin).font(.sc(.body)).tint(Tokens.accent)
            if let error { Text(error).font(.sc(.callout)).foregroundStyle(Tokens.danger) }
            PrimaryButton(title: "Add", style: .brand, isLoading: busy) { Task { await add() } }
        }
        .fitSheetScroll()
    }

    private func add() async {
        let n = name.trimmingCharacters(in: .whitespaces), e = email.trimmingCharacters(in: .whitespaces)
        guard n.count >= 2, e.contains("@") else { error = "Add a name and a valid email."; return }
        busy = true; error = nil
        defer { busy = false }
        do {
            _ = try await context.repo.addStaff(name: n, email: e, designation: designation.trimmingCharacters(in: .whitespaces).isEmpty ? "Teacher" : designation, permissions: permissions.sorted(), sendLogin: sendLogin)
            done()
        } catch { self.error = (error as? ApiError)?.message ?? "That could not be added. Try again." }
    }
}
