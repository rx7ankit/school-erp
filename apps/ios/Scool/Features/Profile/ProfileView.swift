import SwiftUI

struct ProfileView: View {
    let child: Child

    var body: some View {
        ScreenScroll {
            HStack(spacing: Tokens.Space.s4) {
                Avatar(name: child.name, size: 64)
                TwoToneTitle(ink: child.name, grey: "Class \(child.classLabel)", role: .title2)
            }

            if child.hasLeft, let leftOn = child.leftOn {
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                        Text("Left school on \(IST.date(leftOn))")
                            .font(.sc(.body, weight: .semibold))
                            .foregroundStyle(Tokens.danger)
                        Text("Records stay readable. Messaging is turned off.")
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }

            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: "Class", value: child.classLabel)
                    InfoRow(label: "Roll no", value: "\(child.rollNo)")
                    InfoRow(label: "Scholar no", value: child.scholarNo)
                    InfoRow(label: "Date of birth", value: IST.date(child.dob))
                    InfoRow(label: "Class teacher", value: child.classTeacher)
                    HStack {
                        Text("Status").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                        Spacer()
                        Pill(text: child.hasLeft ? "Left school" : "Active", tone: child.hasLeft ? .danger : .success)
                    }
                }
            }

            SectionLabel("Guardians")
            ForEach(child.guardians, id: \.self) { guardian in
                Card {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(guardian.name).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                        Text("\(guardian.relation) - \(guardian.phone)")
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
