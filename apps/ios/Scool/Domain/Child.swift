import Foundation

enum ChildStatus: String {
    case active
    case left
}

struct Guardian: Hashable {
    let name: String
    let relation: String
    let phone: String
}

struct Child: Identifiable, Hashable {
    let id: String
    let name: String
    let classLabel: String      // "8-B"
    let rollNo: Int
    let scholarNo: String
    let dob: String             // date-only "2012-03-14"
    let classTeacher: String
    let guardians: [Guardian]
    let status: ChildStatus
    let leftOn: String?         // date-only, set when status == .left

    var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
    var hasLeft: Bool { status == .left }
}
