package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.arr
import tech.krevo.app.data.int
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.str
import tech.krevo.app.data.strings

// Models for the Library tab and People & access. Parsed with the null-safe helpers in ApiClient.kt.

data class LibrarySummary(val books: Int, val copies: Int, val onLoan: Int, val overdue: Int) {
    companion object {
        fun from(j: JSONObject) = LibrarySummary(j.int("books"), j.int("copies"), j.int("on_loan"), j.int("overdue"))
    }
}

data class LibraryBook(val id: String, val title: String, val author: String, val category: String?, val copiesTotal: Int, val available: Int) {
    companion object {
        fun from(j: JSONObject) = LibraryBook(j.getString("id"), j.str("title").orEmpty(), j.str("author").orEmpty(), j.str("category"), j.int("copies_total"), j.int("available"))
    }
}

data class LibraryLoan(val id: String, val title: String, val borrower: String, val dueOn: String, val daysOverdue: Int) {
    companion object {
        fun from(j: JSONObject) = LibraryLoan(
            j.getString("id"), j.str("title").orEmpty(), j.str("student_name") ?: j.str("staff_name") ?: "–", j.str("due_on").orEmpty(), j.int("days_overdue"),
        )
    }
}

data class PermissionInfo(val key: String, val label: String, val description: String)
data class AccessPreset(val key: String, val label: String, val permissions: List<String>)

/** `GET /staff/access-options`: the four permissions in plain words, and the one-tap presets. */
data class AccessOptions(val permissions: List<PermissionInfo>, val presets: List<AccessPreset>) {
    companion object {
        fun from(j: JSONObject) = AccessOptions(
            j.arr("permissions").mapObjects { PermissionInfo(it.getString("key"), it.str("label").orEmpty(), it.str("description").orEmpty()) },
            j.arr("presets").mapObjects { AccessPreset(it.getString("key"), it.str("label").orEmpty(), it.strings("permissions")) },
        )
    }
}
