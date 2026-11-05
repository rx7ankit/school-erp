import SwiftUI

/// Attendance tab: the classes this person may mark, then a sheet per class and day.
struct StaffAttendanceView: View {
    @Environment(StaffContext.self) private var context

    var body: some View {
        NavigationStack {
            ScreenScroll {
                StaffHeader(ink: "Attendance.", grey: "Pick a class.")
                if context.markableClasses.isEmpty {
                    EmptyNote(text: "No classes yet.")
                }
                ForEach(context.markableClasses) { cls in
                    NavigationLink(value: cls) {
                        Card {
                            HStack(spacing: Tokens.Space.s3) {
                                Text(cls.label).font(.sc(.title3)).frame(width: 64, alignment: .leading)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Class \(cls.label)").font(.sc(.body, weight: .medium))
                                    Text("\(cls.students ?? 0) students").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Tokens.textTertiary)
                            }
                            .foregroundStyle(Tokens.text)
                            .frame(minHeight: Tokens.Control.md)
                        }
                    }
                    .buttonStyle(.pressable)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: StaffClass.self) { StaffAttendanceSheetView(cls: $0) }
        }
    }
}

/// One class on one day. Tap P / A / L per student, then Save.
struct StaffAttendanceSheetView: View {
    let cls: StaffClass

    @Environment(StaffContext.self) private var context
    @State private var day = IST.todayOn()
    @State private var sheet = Loader<AttendanceSheet>()
    @State private var students: [SheetStudent] = []
    @State private var original: [SheetStudent] = []
    @State private var canMark = true
    @State private var holiday: String?
    @State private var saving = false
    @State private var message: String?
    @State private var saved = false

    private var dirty: Bool { students.map { [$0.firstHalf, $0.secondHalf] } != original.map { [$0.firstHalf, $0.secondHalf] } || (!saved && !original.contains { $0.saved }) }
    private func count(_ v: AttendanceValue) -> Int { students.filter { $0.firstHalf == v && $0.secondHalf == v }.count }

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: "Class \(cls.label).", grey: IST.weekdayName(on: day) + ".", role: .title1)
            dayBar

            LoadableView(sheet.state, retry: { Task { await load() } }) { _ in
                if let holiday { Card { Text("\(holiday). Attendance is not taken on this day.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) } }
                else if !canMark { Card { Text("You can't mark attendance for this class.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) } }

                HStack(spacing: Tokens.Space.s2) {
                    Pill(text: "Present \(count(.present))", tone: .success)
                    Pill(text: "Absent \(count(.absent))", tone: .danger)
                    Pill(text: "Leave \(count(.leave))", tone: .warning)
                }

                if canMark && holiday == nil {
                    Button("Mark everyone present") {
                        Haptics.select()
                        for i in students.indices { students[i].firstHalf = .present; students[i].secondHalf = .present }
                    }
                    .font(.sc(.callout, weight: .semibold))
                    .foregroundStyle(Tokens.text)
                    .frame(minHeight: Tokens.Control.md)
                }

                ForEach($students) { $student in
                    StaffAttendanceRow(student: $student, editable: canMark && holiday == nil)
                }
            }

        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if canMark && holiday == nil && sheet.state.value != nil { saveBar }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: day) { await load() }
    }

    /// Always on screen, so the count and Save are never a long scroll away.
    private var saveBar: some View {
        VStack(spacing: Tokens.Space.s2) {
            if let message { Text(message).font(.sc(.callout)).foregroundStyle(saved ? Tokens.success : Tokens.danger).frame(maxWidth: .infinity, alignment: .leading) }
            if saved && !dirty {
                Label("Saved", systemImage: "checkmark.circle.fill")
                    .font(.sc(.body, weight: .semibold))
                    .foregroundStyle(Tokens.success)
                    .frame(maxWidth: .infinity, minHeight: Tokens.Control.lg)
            } else {
                PrimaryButton(title: "Save attendance", style: .brand, isLoading: saving) { Task { await save() } }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, Tokens.Space.s3)
        .padding(.bottom, Tokens.Space.s2)
        .background(.bar)
    }

    private var dayBar: some View {
        HStack(spacing: Tokens.Space.s3) {
            Button { shift(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("Previous day")
            Spacer()
            Text(IST.date(day)).font(.sc(.body, weight: .semibold))
            Spacer()
            Button { shift(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                .disabled(day >= IST.todayOn()).accessibilityLabel("Next day")
        }
        .foregroundStyle(Tokens.text)
        .padding(.horizontal, Tokens.Space.s2)
        .background(Tokens.card, in: Capsule())
    }

    private func shift(_ delta: Int) {
        let next = IST.addDays(day, delta)
        if next <= IST.todayOn() { day = next }
    }

    private func load() async {
        message = nil
        saved = false
        await sheet.load { try await context.repo.attendanceSheet(classId: cls.id, day: day) }
        if let s = sheet.state.value { apply(s) }
    }

    private func apply(_ s: AttendanceSheet) {
        students = s.students
        original = s.students
        canMark = s.canMark
        holiday = s.holiday
        saved = s.marked
    }

    private func save() async {
        saving = true
        message = nil
        let records = students.map { AttendanceRecord(studentId: $0.studentId, firstHalf: $0.firstHalf, secondHalf: $0.secondHalf, late: $0.late ?? false) }
        do {
            let result = try await context.repo.saveAttendance(classId: cls.id, day: day, records: records)
            sheet.set(result)
            apply(result)
            saved = true
            message = nil
            Haptics.success()
        } catch {
            message = error.localizedDescription
            Haptics.error()
        }
        saving = false
    }
}

private struct StaffAttendanceRow: View {
    @Binding var student: SheetStudent
    let editable: Bool

    var body: some View {
        Card {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: student.name, size: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(student.name).font(.sc(.callout, weight: .medium)).lineLimit(1)
                    Text(student.rollNo.map { "Roll \($0)" } ?? student.scholarNo).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
                }
                Spacer(minLength: Tokens.Space.s2)
                if student.firstHalf != student.secondHalf { Pill(text: "Half", tone: .warning) }
                HStack(spacing: 6) {
                    chip("P", .present, Tokens.success)
                    chip("A", .absent, Tokens.danger)
                    chip("L", .leave, Tokens.warning)
                }
            }
        }
    }

    private func chip(_ title: String, _ value: AttendanceValue, _ tone: Color) -> some View {
        let on = student.firstHalf == value && student.secondHalf == value
        return Button {
            Haptics.select()
            student.firstHalf = value
            student.secondHalf = value
        } label: {
            Text(title).font(.sc(.callout, weight: .bold))
                .foregroundStyle(on ? Color.white : Tokens.textSecondary)
                .frame(width: 38, height: 38)
                .background(on ? tone : Tokens.fill, in: Circle())
        }
        .buttonStyle(.pressable)
        .disabled(!editable)
        .opacity(editable || on ? 1 : 0.5)
        .accessibilityLabel("\(student.name), \(value.rawValue)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
