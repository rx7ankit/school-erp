package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.strings

/** The five permissions. There is no separate admin: full access is all five. */
object Permission {
    const val ACADEMIC = "academic.manage"
    const val FEES = "fees.manage"
    const val LIBRARY = "library.manage"
    const val ANNOUNCEMENTS = "announcements.manage"
    const val PEOPLE = "people.manage"
    val ALL = listOf(ACADEMIC, FEES, LIBRARY, ANNOUNCEMENTS, PEOPLE)
}

/** What this person's app shows, decided by the server from their permissions (`GET /home/layout`). */
data class HomeLayout(val tabs: List<String>, val menu: List<String>, val blocks: List<String>, val hasAssignments: Boolean) {

    /** The Home blocks in the order to draw them: Notices last (the work comes first), no empty "My classes" for
     *  someone who teaches nothing but runs a department, and work blocks leading for someone who manages something. */
    fun homeBlocks(): List<String> {
        val hasWork = blocks.any { it in WORK_BLOCKS }
        var list = blocks.filter { it != NOTICES }
        if (hasWork && !hasAssignments) {
            list = list.filter { it != MY_CLASSES }.sortedBy { if (it in WORK_BLOCKS) 0 else 1 }
        }
        return if (NOTICES in blocks) list + NOTICES else list
    }

    companion object {
        const val MY_CLASSES = "my_classes"
        const val NOTICES = "notices"
        private val WORK_BLOCKS = setOf("academic", "fees", "library", "people")

        fun from(j: JSONObject) = HomeLayout(j.strings("tabs"), j.strings("menu"), j.strings("blocks"), j.optBoolean("has_assignments"))

        /** The layout worked out from the permissions, for when the server's cannot be fetched. Mirrors `GET /home/layout`. */
        fun fallback(permissions: Collection<String>, hasAssignments: Boolean): HomeLayout {
            val tabs = mutableListOf("home", "messages")
            val blocks = mutableListOf("my_day", MY_CLASSES, NOTICES)
            val menu = mutableListOf<String>()
            for ((permission, name) in listOf(Permission.ACADEMIC to "academic", Permission.FEES to "fees", Permission.LIBRARY to "library")) {
                if (permission in permissions) { tabs += name; blocks += name }
            }
            if (Permission.PEOPLE in permissions) { menu += "people"; blocks += "people" }
            return HomeLayout(tabs, menu, blocks, hasAssignments)
        }
    }
}
