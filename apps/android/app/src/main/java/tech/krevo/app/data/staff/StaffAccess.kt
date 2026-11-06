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

    /**
     * The Home blocks in the order to draw them. The server's [blocks] only say which ones this person gets: Notices, the
     * day, my classes (left out for someone who teaches nothing but runs a department), then fees and people. Academic
     * has no block on Home (it is a tab), and there is no Library.
     */
    fun homeBlocks(): List<String> {
        val has = blocks.toSet()
        val hasWork = has.any { it in WORK_BLOCKS }
        return buildList {
            if (NOTICES in has) add(NOTICES)
            if (MY_DAY in has) add(MY_DAY)
            if (MY_CLASSES in has && (hasAssignments || !hasWork)) add(MY_CLASSES)
            addAll(listOf("fees", "people").filter { it in has })
        }
    }

    /** Today's classes hide when empty for someone whose Home has other work on it. */
    val hasWorkBlocks: Boolean get() = blocks.any { it in WORK_BLOCKS }

    companion object {
        const val MY_CLASSES = "my_classes"
        const val MY_DAY = "my_day"
        const val NOTICES = "notices"
        const val ACADEMIC = "academic"
        private val WORK_BLOCKS = setOf(ACADEMIC, "fees", "people")

        fun from(j: JSONObject) = HomeLayout(j.strings("tabs"), j.strings("menu"), j.strings("blocks"), j.optBoolean("has_assignments"))

        /** The layout worked out from the permissions, for when the server's cannot be fetched. Mirrors `GET /home/layout`. */
        fun fallback(permissions: Collection<String>, hasAssignments: Boolean): HomeLayout {
            val tabs = mutableListOf("home", "messages")
            val blocks = mutableListOf(MY_DAY, MY_CLASSES, NOTICES)
            val menu = mutableListOf<String>()
            for ((permission, name) in listOf(Permission.ACADEMIC to "academic", Permission.FEES to "fees")) {
                if (permission in permissions) { tabs += name; blocks += name }
            }
            if (Permission.PEOPLE in permissions) { menu += "people"; blocks += "people" }
            return HomeLayout(tabs, menu, blocks, hasAssignments)
        }
    }
}
