import Foundation

/// Grade bands used for subjects and for the overall grade on report cards.
enum Grading {
    static func letter(percentage p: Double) -> String {
        if p >= 90 { return "A+" }
        if p >= 80 { return "A" }
        if p >= 70 { return "B+" }
        if p >= 60 { return "B" }
        if p >= 50 { return "C" }
        return "D"
    }
}
