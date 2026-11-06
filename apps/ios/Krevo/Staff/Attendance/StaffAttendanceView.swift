import SwiftUI

/// The Classes tab: every class this person may open, two to a row, with the day's attendance percentage on each.
/// A date control looks at any past day. Tap a class for its page; marking attendance is a button on that page.
struct StaffAttendanceView: View {
    /// Inside another screen's navigation (the Academic hub, or pushed from Home): show a back button and a small title.
    var embedded = false

    @Environment(StaffContext.self) private var context
    @State private var day = IST.todayOn()
    @State private var overview = Loader<StaffDayOverview>()

    private let columns = [GridItem(.flexible(), spacing: Tokens.Space.s3), GridItem(.flexible(), spacing: Tokens.Space.s3)]

    private var dateBinding: Binding<Date> {
        Binding(get: { IST.pickerDate(on: day) }, set: { day = IST.on(pickerDate: $0) })
    }

    var body: some View {
        StackIf(embedded: embedded) {
            ScreenScroll {
                summary
                if let holiday = overview.state.value?.holiday {
                    Text("\(holiday). Attendance is not taken on this day.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
                if context.markableClasses.isEmpty {
                    EmptyNote(text: "No classes yet.")
                } else {
                    LazyVGrid(columns: columns, spacing: Tokens.Space.s3) {
                        ForEach(context.markableClasses) { cls in
                            NavigationLink(value: cls) { card(cls, overview.state.value?.classes.first { $0.classId == cls.id }) }
                                .buttonStyle(.pressable)
                        }
                    }
                }
            }
            .refreshable { await load() }
            .toolbar(embedded ? .automatic : .hidden, for: .navigationBar)
            .navigationTitle(embedded ? "Classes" : "")
            .navigationBarTitleDisplayMode(.inline)
            .task(id: day) { await load() }
            .navigationDestination(for: StaffClass.self) { StaffClassDetailView(cls: $0, day: day).hidesTabBar() }
            .navigationDestination(for: AttendanceTarget.self) { StaffAttendanceSheetView(cls: $0.cls, day: $0.day).hidesTabBar() }
        }
    }

    /// Today's (or the chosen day's) overall percentage and how many classes are marked, with the date control beside it.
    private var summary: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(day == IST.todayOn() ? "Today" : IST.date(day)).font(.sc(.caption, weight: .semibold))
                    .foregroundStyle(Tokens.textSecondary).textCase(.uppercase)
                if let o = overview.state.value {
                    Text(o.percentage.map { String(format: "%.0f%%", $0) } ?? "–").font(.sc(.title1)).foregroundStyle(Tokens.text).monospacedDigit()
                    Text("\(o.classesMarked) of \(o.classesTotal) classes marked").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                } else {
                    SkeletonLine(width: 90, role: .title1)
                    SkeletonLine(width: 150, role: .callout)
                }
            }
            Spacer(minLength: Tokens.Space.s2)
            DatePicker("Date", selection: dateBinding, in: ...IST.pickerDate(on: IST.todayOn()), displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .environment(\.timeZone, IST.pickerZone)
                .padding(.horizontal, 6).padding(.vertical, 4)
                .chromeSurface(in: Capsule(), interactive: true)
        }
    }

    private func card(_ cls: StaffClass, _ d: StaffClassDay?) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Space.s2) {
            Text("Class \(cls.label)").font(.sc(.body, weight: .semibold)).foregroundStyle(Tokens.text)
            Text("\(cls.students ?? 0) students").font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Spacer(minLength: Tokens.Space.s2)
            if let d, d.marked, let pct = d.percentage {
                Text(String(format: "%.0f%%", pct)).font(.sc(.title2)).foregroundStyle(Tokens.text).monospacedDigit()
                BrandProgress(fraction: pct / 100)
            } else if d != nil {
                HStack(spacing: 6) {
                    Circle().fill(Tokens.accent).frame(width: 7, height: 7)
                    Text("Not marked").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                }
            } else {
                SkeletonLine(width: 60, role: .title2)
            }
        }
        .padding(Tokens.Space.s4)
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func load() async {
        await overview.load { try await context.repo.dayOverview(day: day) }
    }
}

/// Where the Attendance button on a class page goes.
struct AttendanceTarget: Hashable {
    let cls: StaffClass
    let day: String
}

/// One class: its numbers, who teaches it, and a button to take attendance.
struct StaffClassDetailView: View {
    let cls: StaffClass
    let day: String

    @Environment(StaffContext.self) private var context
    @State private var info = Loader<ClassInfo>()
    @State private var today = Loader<StaffDayOverview>()

    struct ClassInfo { var classTeacher: String?; var subjects: [(name: String, teacher: String?)] }

    var body: some View {
        ScreenScroll {
            Text("Class \(cls.label)").font(.sc(.title1)).foregroundStyle(Tokens.text).frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: Tokens.Space.s3) {
                stat("Students", "\(cls.students ?? 0)")
                stat(day == IST.todayOn() ? "Today" : IST.date(day), todayPercent)
            }

            NavigationLink(value: AttendanceTarget(cls: cls, day: day)) {
                HStack(spacing: 6) {
                    Text("Attendance").font(.sc(.body, weight: .semibold))
                    Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Tokens.onAccent)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Tokens.accent, in: Capsule())
            }
            .buttonStyle(.pressable)

            LoadableView(info.state, retry: { Task { await load() } }) { i in
                GroupHeading("Class teacher")
                PlainLine(showsDivider: false) {
                    Text(i.classTeacher ?? "Not assigned").font(.sc(.body, weight: .medium)).foregroundStyle(i.classTeacher == nil ? Tokens.textSecondary : Tokens.text)
                }
                GroupHeading("Subjects")
                if i.subjects.isEmpty { Text("No subjects set up yet.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }
                VStack(spacing: 0) {
                    ForEach(Array(i.subjects.enumerated()), id: \.offset) { n, s in
                        PlainLine(showsDivider: n < i.subjects.count - 1) {
                            HStack {
                                Text(s.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text)
                                Spacer()
                                Text(s.teacher ?? "No teacher").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var todayPercent: String {
        guard let c = today.state.value?.classes.first(where: { $0.classId == cls.id }), c.marked, let p = c.percentage else { return "Not marked" }
        return String(format: "%.0f%%", p)
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.sc(.caption)).foregroundStyle(Tokens.textSecondary)
            Text(value).font(.sc(.title3)).foregroundStyle(Tokens.text).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(Tokens.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Tokens.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func load() async {
        async let t: () = today.load { try await context.repo.dayOverview(day: day) }
        await info.load {
            async let rows = context.repo.assignments(classId: cls.id)
            async let subjects = context.repo.subjects()
            let (assignments, all) = try await (rows, subjects)
            let names = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0.name) })
            let ids = cls.subjectIds ?? []
            let list = ids.compactMap { id -> (name: String, teacher: String?)? in
                guard let name = names[id] else { return nil }
                return (name, assignments.first { $0.subjectId == id }?.staffName)
            }.sorted { $0.name < $1.name }
            return ClassInfo(classTeacher: assignments.first { $0.role == "class_teacher" }?.staffName, subjects: list)
        }
        _ = await t
    }
}

/// One class on one day. Tap P / A / L per student, then Save.
struct StaffAttendanceSheetView: View {
    let cls: StaffClass

    init(cls: StaffClass, day: String = IST.todayOn()) {
        self.cls = cls
        _day = State(initialValue: day)
    }

    @Environment(StaffContext.self) private var context
    @State private var day: String
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
            TwoToneTitle(ink: "Class \(cls.label)", grey: "", role: .title1)
            dayBar

            LoadableView(sheet.state, retry: { Task { await load() } }) { _ in
                if let holiday { Text("\(holiday). Attendance is not taken on this day.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }
                else if !canMark { Text("You can't mark attendance for this class.").font(.sc(.callout)).foregroundStyle(Tokens.textSecondary) }

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

                VStack(spacing: 0) {
                    ForEach($students) { $student in
                        StaffAttendanceRow(student: $student, editable: canMark && holiday == nil, showsDivider: student.id != students.last?.id)
                    }
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
    var showsDivider = true

    var body: some View {
        PlainLine(showsDivider: showsDivider, inset: 50) {
            HStack(spacing: Tokens.Space.s3) {
                Avatar(name: student.name, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(student.name).font(.sc(.body, weight: .medium)).foregroundStyle(Tokens.text).lineLimit(1)
                    Text(student.rollNo.map { "Roll \($0)" } ?? student.scholarNo).font(.sc(.callout)).foregroundStyle(Tokens.textSecondary)
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
