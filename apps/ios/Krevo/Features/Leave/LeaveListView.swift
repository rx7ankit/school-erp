import SwiftUI

/// Pushed from More. Lists leave requests and lets the parent apply or cancel a pending one.
struct LeaveListView: View {
    let child: Child

    @Environment(Session.self) private var session
    @State private var vm = LeaveViewModel()
    @State private var showApply = false
    @State private var cancelTarget: LeaveRequest?

    var body: some View {
        ScreenScroll {
            TwoToneTitle(ink: L.t("leave.ink"), grey: L.f("leave.grey", child.firstName), role: .title1)

            if child.hasLeft {
                Card {
                    Text(L.f("leave.left", child.firstName))
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
            } else {
                PrimaryButton(title: L.t("leave.apply"), style: .brand) {
                    showApply = true
                }
            }

            if let message = vm.errorText {
                Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
            }

            LoadableView(vm.requests, retry: { Task { await reload() } }) { list in
                if list.isEmpty {
                    EmptyNote(text: L.t("leave.empty"))
                }
                ForEach(list) { request in
                    row(request)
                }
            }
        }
        .refreshable { await reload() }
        .navigationBarTitleDisplayMode(.inline)
        .task { await reload() }
        .sheet(isPresented: $showApply, onDismiss: { Task { await reload() } }) {
            ApplyLeaveSheet(child: child)
        }
        .confirmationDialog(L.t("leave.cancel_title"), isPresented: cancelBinding, titleVisibility: .visible) {
            Button(L.t("leave.cancel_confirm"), role: .destructive) {
                if let target = cancelTarget {
                    Task { await vm.cancel(repo: session.repo, id: target.id, childId: child.id) }
                }
                cancelTarget = nil
            }
            Button(L.t("leave.keep"), role: .cancel) { cancelTarget = nil }
        }
    }

    private var cancelBinding: Binding<Bool> {
        Binding(get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } })
    }

    private func reload() async {
        await vm.load(repo: session.repo, childId: child.id)
    }

    private func row(_ request: LeaveRequest) -> some View {
        Card {
            VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                HStack(alignment: .top) {
                    Text(IST.dateRange(from: request.fromOn, to: request.toOn))
                        .font(.sc(.body, weight: .semibold))
                        .foregroundStyle(Tokens.text)
                    Spacer()
                    Pill(text: request.status.title, tone: request.status.tone)
                }
                if request.half != .none {
                    Text(request.half.title)
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
                Text(request.reason).font(.sc(.callout)).foregroundStyle(Tokens.text)
                if let note = request.decisionNote, !note.isEmpty {
                    Text(L.f("leave.note", note))
                        .font(.sc(.callout))
                        .foregroundStyle(Tokens.textSecondary)
                }
                Text(L.f("leave.sent", IST.day(request.createdAt)))
                    .font(.sc(.caption))
                    .foregroundStyle(Tokens.textTertiary)
                if request.status == .pending && !child.hasLeft {
                    Button(L.t("leave.cancel")) { cancelTarget = request }
                        .font(.sc(.callout, weight: .semibold))
                        .foregroundStyle(Tokens.danger)
                        .frame(minHeight: Tokens.Control.md)
                }
            }
        }
    }
}

/// Apply for leave: dates are IST calendar dates, never before today.
struct ApplyLeaveSheet: View {
    let child: Child

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var vm = ApplyLeaveViewModel()

    private var today: Date { IST.pickerDate(on: IST.todayOn()) }

    private var fromBinding: Binding<Date> {
        Binding(get: { IST.pickerDate(on: vm.fromOn) },
                set: { vm.fromOn = IST.on(pickerDate: $0); vm.fromChanged() })
    }

    private var toBinding: Binding<Date> {
        Binding(get: { IST.pickerDate(on: vm.toOn) },
                set: { vm.toOn = IST.on(pickerDate: $0); vm.toChanged() })
    }

    private var halfDayBinding: Binding<Bool> {
        Binding(get: { vm.half != .none }, set: { vm.half = $0 ? .first : .none })
    }

    var body: some View {
        NavigationStack {
            ScreenScroll {
                TwoToneTitle(ink: L.t("leave.apply_ink"), grey: L.f("leave.apply_grey", child.firstName), role: .title2)

                Card {
                    VStack(spacing: Tokens.Space.s2) {
                        DatePicker(L.t("leave.from"), selection: fromBinding, in: today..., displayedComponents: .date)
                            .environment(\.timeZone, IST.pickerZone)
                        DatePicker(L.t("leave.to"), selection: toBinding,
                                   in: IST.pickerDate(on: vm.fromOn)..., displayedComponents: .date)
                            .environment(\.timeZone, IST.pickerZone)
                    }
                    .font(.sc(.body))
                }

                Card {
                    VStack(alignment: .leading, spacing: Tokens.Space.s2) {
                        Toggle(L.t("leave.half_only"), isOn: halfDayBinding)
                            .font(.sc(.body))
                            .tint(Tokens.solid)
                            .disabled(!vm.isSingleDay)
                        if vm.half != .none {
                            Picker(L.t("leave.half_which"), selection: $vm.half) {
                                Text(LeaveHalf.first.title).tag(LeaveHalf.first)
                                Text(LeaveHalf.second.title).tag(LeaveHalf.second)
                            }
                            .pickerStyle(.segmented)
                        }
                        if !vm.isSingleDay {
                            Text(L.t("leave.half_hint"))
                                .font(.sc(.caption))
                                .foregroundStyle(Tokens.textSecondary)
                        }
                    }
                }

                VStack(alignment: .trailing, spacing: Tokens.Space.s1) {
                    TextEditor(text: $vm.reason)
                        .font(.sc(.callout))
                        .scrollContentBackground(.hidden)
                        .padding(Tokens.Space.s2)
                        .frame(minHeight: 110)
                        .background(Tokens.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.control, style: .continuous))
                        .overlay(alignment: .topLeading) {
                            if vm.reason.isEmpty {
                                Text(L.t("leave.reason"))
                                    .font(.sc(.callout))
                                    .foregroundStyle(Tokens.textTertiary)
                                    .padding(.horizontal, Tokens.Space.s3)
                                    .padding(.vertical, Tokens.Space.s2 + 8)
                                    .allowsHitTesting(false)
                                    .accessibilityHidden(true)
                            }
                        }
                        .accessibilityLabel(L.t("leave.reason"))
                        .onChange(of: vm.reason) { _, newValue in
                            if newValue.count > LeaveRules.maxReasonLength {
                                vm.reason = String(newValue.prefix(LeaveRules.maxReasonLength))
                            }
                        }
                    Text("\(vm.reason.count)/\(LeaveRules.maxReasonLength)")
                        .font(.sc(.caption))
                        .foregroundStyle(Tokens.textTertiary)
                }

                if let message = vm.errorText {
                    Text(message).font(.sc(.callout)).foregroundStyle(Tokens.danger)
                }

                PrimaryButton(title: L.t("leave.submit"), style: .brand, isLoading: vm.isSubmitting, isEnabled: vm.canSubmit) {
                    Task {
                        if await vm.submit(repo: session.repo, childId: child.id) { dismiss() }
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L.t("common.cancel")) { dismiss() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
