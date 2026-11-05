import SwiftUI

struct StaffProfileView: View {
    @Environment(StaffContext.self) private var context

    var body: some View {
        ScreenScroll {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: context.me.name, size: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.me.name).font(.sc(.title3))
                    Pill(text: context.access.roleTitle, tone: .accent)
                }
            }
            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: "Email", value: context.me.email)
                    if let school = context.me.school { InfoRow(label: "School", value: school.name) }
                    InfoRow(label: "Access", value: context.access.isAdmin ? "Full admin access" : "Teacher")
                }
            }
            if !context.me.assignments.isEmpty {
                SectionLabel("My classes")
                ForEach(context.me.assignments, id: \.self) { a in
                    let label = context.classes.first { $0.id == a.classId }?.label ?? "Class"
                    Card { HStack { Text("Class \(label)").font(.sc(.body, weight: .medium)); Spacer(); Pill(text: a.role == "class_teacher" ? "Class teacher" : "Subject teacher") } }
                }
            }
            if !context.me.permissions.isEmpty {
                SectionLabel("Permissions")
                Card { Text(context.me.permissions.map { $0.replacingOccurrences(of: ".manage", with: "").capitalized }.joined(separator: ", ")).font(.sc(.callout)) }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
