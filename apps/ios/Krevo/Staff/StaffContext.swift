import Foundation
import Observation

/// Who is signed in on the staff side, and where their data comes from. Created by `Session` and handed to every staff screen.
@Observable
@MainActor
final class StaffContext {
    let repo: any StaffRepository
    private(set) var me: StaffMe
    var access: StaffAccess { StaffAccess(me: me) }
    let chat: ChatAPI
    /// Classes in this school, loaded once by the root view and shared by Attendance, Students and Announcements.
    private(set) var classes: [StaffClass] = []
    /// Pending leave requests the person can act on. Shown as a badge on the Academic tab.
    var pendingLeaves = 0
    /// What the server says this person's app shows (tabs, menu, Home blocks).
    private(set) var serverLayout: HomeLayout?

    /// The layout to draw: the server's, or one worked out from the permissions until it arrives (and in preview builds).
    var layout: HomeLayout {
        #if DEBUG
        if StaffAccess.isPreviewing { return access.fallbackLayout }
        #endif
        return serverLayout ?? access.fallbackLayout
    }

    func loadLayout() async {
        if let l = try? await repo.homeLayout() { serverLayout = l }
    }

    init(repo: any StaffRepository, me: StaffMe, chat: ChatAPI) {
        self.repo = repo
        self.chat = chat
        self.me = me
    }

    /// Reloads who I am (photo and school logo links expire, and the admin may have just uploaded a logo).
    func refreshMe() async {
        if let fresh = try? await repo.me() { me = fresh }
    }

    /// Saves a new photo, or removes it when `jpeg` is nil, then reloads.
    func setPhoto(jpeg: Data?) async throws {
        try await repo.setPhoto(jpeg: jpeg)
        await refreshMe()
    }

    /// Classes this person may mark attendance for (all for admin, their own for a class teacher).
    var markableClasses: [StaffClass] {
        let ids = Set(access.classIdsToMark(all: classes.map(\.id)))
        return classes.filter { ids.contains($0.id) }
    }

    func loadClasses() async {
        if let list = try? await repo.classes() { classes = list }
    }

    func refreshPendingLeaves() async {
        guard access.canMarkAttendance else { pendingLeaves = 0; return }
        pendingLeaves = (try? await repo.leaves(status: "pending").count) ?? 0
    }
}
