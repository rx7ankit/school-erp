import SwiftUI

struct ProfileView: View {
    let child: Child

    var body: some View {
        ScreenScroll {
            HStack(spacing: Tokens.Space.s4) {
                Avatar(name: child.name, size: 64)
                TwoToneTitle(ink: child.name, grey: "", role: .title2)
            }

            if child.hasLeft, let leftOn = child.leftOn {
                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s1) {
                        Text(L.f("profile.left_on", IST.date(leftOn)))
                            .font(.sc(.body, weight: .semibold))
                            .foregroundStyle(Tokens.danger)
                        Text(L.t("profile.left_note"))
                            .font(.sc(.callout))
                            .foregroundStyle(Tokens.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }

            Card {
                VStack(spacing: Tokens.Space.s3) {
                    InfoRow(label: L.t("profile.class"), value: child.classLabel)
                    InfoRow(label: L.t("profile.roll"), value: "\(child.rollNo)")
                    InfoRow(label: L.t("profile.scholar"), value: child.scholarNo)
                    InfoRow(label: L.t("profile.dob"), value: IST.date(child.dob))
                    InfoRow(label: L.t("common.class_teacher"), value: child.classTeacher)
                    HStack {
                        Text(L.t("common.status")).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                        Spacer()
                        Pill(text: child.hasLeft ? L.t("profile.left") : L.t("profile.active"), tone: child.hasLeft ? .danger : .success)
                    }
                }
            }

            SectionLabel(L.t("profile.guardians"))
            ForEach(child.guardians, id: \.self) { guardian in
                Card {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(guardian.name).font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
                        Text("\(L.known("relation", guardian.relation)) - \(guardian.phone)")
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
