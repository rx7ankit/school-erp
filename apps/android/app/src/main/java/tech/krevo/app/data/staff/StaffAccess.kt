package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.strings

/** The four permissions. There is no separate admin: full access is all four. */
object Permission {
    const val ACADEMIC = "academic.manage"
    const val FEES = "fees.manage"
    const val ANNOUNCEMENTS = "announcements.manage"
    const val PEOPLE = "people.manage"
    val ALL = listOf(ACADEMIC, FEES, ANNOUNCEMENTS, PEOPLE)
}

/** What this person's app shows, decided by the server from their permissions (`GET /home/layout`). */
data class HomeLayout(val tabs: List<String>, val menu: List<String>, val blocks: List<String>, val hasAssignments: Boolean) {

    /**
     * The Home blocks in the order to draw them. The server's [blocks] only say which ones this person gets: the class teacher's attendance row, Notices, the
     * day, my classes (left out for someone who teaches nothing but runs a department), then fees. Academic
     * and People are tabs, so they have no block on Home
     * has no block on Home (it is a tab).
     */
    fun homeBlocks(): List<String> {
        val has = blocks.toSet()
        val hasWork = has.any { it in WORK_BLOCKS }
        return buildList {
            if (MY_CLASSES in has) add(MY_ATTENDANCE)
            if (NOTICES in has) add(NOTICES)
            if (MY_DAY in has) add(MY_DAY)
            if (MY_CLASSES in has && (hasAssignments || !hasWork)) add(MY_CLASSES)
            if ("fees" in has) add("fees")
        }
    }

    /**
     * The tabs to show, in order. People is decided here from the permission and never from the server's list (which does
     * not send it yet), and goes last, after Home, Messages, Academic and Fees.
     */
    fun tabKeys(canManagePeople: Boolean): List<String> = tabs.filter { it != "people" } + if (canManagePeople) listOf("people") else emptyList()

    /** Today's classes hide when empty for someone whose Home has other work on it. */
    val hasWorkBlocks: Boolean get() = blocks.any { it in WORK_BLOCKS }

    companion object {
        const val MY_CLASSES = "my_classes"
        const val MY_DAY = "my_day"
        const val NOTICES = "notices"
        const val ACADEMIC = "academic"
        /** Not sent by the server: the class teacher's attendance row, drawn first. */
        const val MY_ATTENDANCE = "my_attendance"
        private val WORK_BLOCKS = setOf(ACADEMIC, "fees")

        fun from(j: JSONObject) = HomeLayout(j.strings("tabs"), j.strings("menu"), j.strings("blocks"), j.optBoolean("has_assignments"))

        /** The layout worked out from the permissions, for when the server's cannot be fetched. Mirrors `GET /home/layout`. */
        fun fallback(permissions: Collection<String>, hasAssignments: Boolean): HomeLayout {
            val tabs = mutableListOf("home", "messages")
            val blocks = mutableListOf(MY_DAY, MY_CLASSES, NOTICES)
            val menu = mutableListOf<String>()
            for ((permission, name) in listOf(Permission.ACADEMIC to "academic", Permission.FEES to "fees")) {
                if (permission in permissions) { tabs += name; blocks += name }
            }
            return HomeLayout(tabs, menu, blocks, hasAssignments)
        }
    }
}
