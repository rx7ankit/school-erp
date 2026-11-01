import Foundation
import Observation

/// Messages tab: the Updates feed summary plus the child's teacher threads.
@Observable
@MainActor
final class MessagesViewModel {
    var updates: Loadable<[Update]> = .loading
    var threads: Loadable<[TeacherThread]> = .loading

    func load(repo: any Repository, childId: String) async {
        async let u = Loadable<[Update]>.capture { try await repo.updates(childId: childId) }
        async let t = Loadable<[TeacherThread]>.capture { try await repo.teacherThreads(childId: childId) }
        updates = await u
        threads = await t
    }

    /// Class teacher first, then by subject. Only teachers who currently teach the child.
    static func current(_ list: [TeacherThread]) -> [TeacherThread] {
        sorted(list.filter { $0.isActive })
    }

    /// Former teachers, shown greyed out in their own section.
    static func previous(_ list: [TeacherThread]) -> [TeacherThread] {
        sorted(list.filter { !$0.isActive })
    }

    private static func sorted(_ list: [TeacherThread]) -> [TeacherThread] {
        list.sorted {
            if $0.isClassTeacher != $1.isClassTeacher { return $0.isClassTeacher }
            return ($0.subject, $0.teacher) < ($1.subject, $1.teacher)
        }
    }
}

/// The unified Updates feed with its filter chips.
@Observable
@MainActor
final class UpdatesViewModel {
    var updates: Loadable<[Update]> = .loading
    /// nil = All, "School", or a subject name.
    var filter: String?

    func load(repo: any Repository, childId: String) async {
        let result = await Loadable<[Update]>.capture { try await repo.updates(childId: childId) }
        if let list = result.value {
            updates = .loaded(list.sorted { $0.at > $1.at })
        } else {
            updates = result
        }
    }

    func markRead(repo: any Repository, childId: String) async {
        try? await repo.markUpdatesRead(childId: childId)
    }

    /// Subjects that appear in the feed, in order of first appearance (School and General are not subjects).
    func subjects(in list: [Update]) -> [String] {
        var seen: [String] = []
        for item in list where item.kind == .classBroadcast && item.tag != Update.generalTag && !seen.contains(item.tag) {
            seen.append(item.tag)
        }
        return seen
    }

    func filtered(_ list: [Update]) -> [Update] {
        guard let tag = filter else { return list }
        return list.filter { $0.tag == tag }
    }
}
