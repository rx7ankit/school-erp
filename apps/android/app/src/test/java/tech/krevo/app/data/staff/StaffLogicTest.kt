package tech.krevo.app.data.staff

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StaffLogicTest {
    private fun layout(vararg p: String, teaches: Boolean = true) = HomeLayout.fallback(p.toList(), teaches)

    // ---- layout fallback

    @Test fun plainTeacherGetsHomeAndMessagesOnly() {
        val l = layout()
        assertEquals(listOf("home", "messages"), l.tabs)
        assertEquals(listOf("my_day", "my_classes", "notices"), l.blocks)
        assertTrue(l.menu.isEmpty())
    }

    @Test fun eachPermissionAddsItsTabAndBlock() {
        val l = layout(Permission.FEES, Permission.ACADEMIC)
        assertEquals(listOf("home", "messages", "academic", "fees"), l.tabs)
        assertEquals(listOf("my_day", "my_classes", "notices", "academic", "fees"), l.blocks)
    }

    @Test fun peopleIsABlockAndMenuEntryButNotATab() {
        val l = layout(Permission.PEOPLE)
        assertEquals(listOf("home", "messages"), l.tabs)
        assertEquals(listOf("people"), l.menu)
        assertTrue("people" in l.blocks)
    }

    @Test fun announcementsPermissionAddsNoTab() {
        assertEquals(listOf("home", "messages"), layout(Permission.ANNOUNCEMENTS).tabs)
    }

    private fun order(vararg blocks: String, teaches: Boolean = true) = HomeLayout(emptyList(), emptyList(), blocks.toList(), teaches).homeBlocks()

    @Test fun homeBlocksFollowTheSetOrder() {
        val l = layout(Permission.ACADEMIC, Permission.FEES, Permission.LIBRARY, Permission.PEOPLE)
        assertEquals(
            listOf("my_attendance", "academic", "notices", "my_day", "my_classes", "academic_stats", "fees", "library", "people"),
            l.homeBlocks(),
        )
    }

    @Test fun aPlainTeacherGetsAttendanceNoticesDayClasses() {
        assertEquals(listOf("my_attendance", "notices", "my_day", "my_classes"), layout().homeBlocks())
    }

    @Test fun serverOrderIsOnlyAnAllowList() {
        assertEquals(listOf("notices", "fees"), order("fees", "notices"))
        assertEquals(listOf("my_attendance", "notices", "my_day", "my_classes"), order("notices", "my_classes", "my_day"))
    }

    @Test fun aManagerWhoTeachesNothingHasNoMyClasses() {
        val l = layout(Permission.FEES, teaches = false)
        assertEquals(listOf("my_attendance", "notices", "my_day", "fees"), l.homeBlocks())
        assertTrue(l.hasWorkBlocks)
    }

    @Test fun aManagerWhoTeachesKeepsMyClasses() {
        assertEquals(listOf("my_attendance", "notices", "my_day", "my_classes", "fees"), layout(Permission.FEES, teaches = true).homeBlocks())
    }

    @Test fun anUnknownBlockIsDropped() {
        assertEquals(listOf("notices"), order("notices", "something_new"))
    }

    // ---- notices

    private fun notice(id: String) = Broadcast(id, "T", "B", "2026-11-05T01:00:00Z", "school", null, "S", 0, 0)

    @Test fun noticePagingAsksForTheNextOffsetUntilEverythingIsLoaded() {
        var pages = NoticePages()
        assertEquals(0, pages.nextOffset)
        pages = pages.appended(Page((1..20).map { notice("n$it") }, 45))
        assertEquals(20, pages.nextOffset)
        assertTrue(pages.hasMore)
        pages = pages.appended(Page((21..40).map { notice("n$it") }, 45))
        assertEquals(40, pages.nextOffset)
        pages = pages.appended(Page((41..45).map { notice("n$it") }, 45))
        assertEquals(45, pages.items.size)
        assertTrue(!pages.hasMore)
    }

    @Test fun aNoticeSeenTwiceIsKeptOnce() {
        val pages = NoticePages(listOf(notice("a"), notice("b")), 3).appended(Page(listOf(notice("b"), notice("c")), 3))
        assertEquals(listOf("a", "b", "c"), pages.items.map { it.id })
    }

    @Test fun onlyAnnouncersAndTeachersMayWriteANotice() {
        assertTrue(me(Permission.ANNOUNCEMENTS).canWriteNotice)
        assertTrue(!me(Permission.FEES).canWriteNotice)
        val teacher = me().copy(assignments = listOf(StaffAssignment("c1", "subject_teacher", "m")))
        assertTrue(teacher.canWriteNotice)
    }

    // ---- full access

    private fun me(vararg p: String) = StaffMe("1", "A B", "a@b.c", null, p.toList(), emptyList(), null, null, null)

    @Test fun fullAccessMeansAllFive() {
        assertTrue(me(*Permission.ALL.toTypedArray()).fullAccess)
        assertEquals(5, Permission.ALL.size)
        assertEquals(false, me(Permission.ACADEMIC, Permission.FEES, Permission.LIBRARY, Permission.PEOPLE).fullAccess)
        assertEquals("Full access", me(*Permission.ALL.toTypedArray()).roleTitle)
        assertEquals("Teacher", me().roleTitle)
    }

    // ---- switches and summary

    @Test fun togglingAddsAndRemoves() {
        val on = AccessEditing.toggle(emptySet(), Permission.FEES, true)
        assertEquals(setOf(Permission.FEES), on)
        assertEquals(emptySet<String>(), AccessEditing.toggle(on, Permission.FEES, false))
    }

    @Test fun retiredPermissionIsIgnored() {
        assertEquals(setOf(Permission.PEOPLE), AccessEditing.known(listOf("staff.manage", Permission.PEOPLE)))
    }

    @Test fun summaryNamesAccess() {
        assertEquals("Principal · Full access", AccessEditing.summary("Principal", Permission.ALL))
        assertEquals("Accountant · Fees", AccessEditing.summary("Accountant", listOf(Permission.FEES)))
        assertEquals("Teacher", AccessEditing.summary("Teacher", emptyList()))
        assertEquals("Fees, Library", AccessEditing.summary("", listOf(Permission.LIBRARY, Permission.FEES)))
    }

    // ---- attendance card

    private fun day(id: String, marked: Boolean) = ClassDay(id, id, marked, if (marked) 90.0 else null)
    private fun overview(holiday: String? = null, vararg c: ClassDay) = DayOverview("2026-11-05", holiday, c.size, c.count { it.marked }, null, c.toList())

    @Test fun allMarked() {
        val o = overview(null, day("a", true), day("b", true))
        assertEquals(AttendanceCard.AllMarked, attendanceCard(setOf("a"), o, false))
    }

    @Test fun someToMarkListsOnlyMyUnmarkedClasses() {
        val o = overview(null, day("a", false), day("b", false), day("c", true))
        val card = attendanceCard(setOf("a", "c"), o, false) as AttendanceCard.ToMark
        assertEquals(listOf("a"), card.classes.map { it.classId })
    }

    @Test fun holidayAndSundayAreNoSchool() {
        val o = overview("Diwali", day("a", false))
        assertEquals(AttendanceCard.NoSchool("Diwali"), attendanceCard(setOf("a"), o, false))
        assertEquals(AttendanceCard.NoSchool("Sunday"), attendanceCard(setOf("a"), overview(null, day("a", false)), true))
    }

    @Test fun markedOnAHolidayStillCounts() {
        assertEquals(AttendanceCard.AllMarked, attendanceCard(setOf("a"), overview("Diwali", day("a", true)), false))
    }

    @Test fun notAClassTeacherHasNothingToMark() {
        assertEquals(AttendanceCard.NothingToMark, attendanceCard(emptySet(), overview(null, day("a", false)), false))
        assertEquals(AttendanceCard.NothingToMark, attendanceCard(setOf("z"), overview(null, day("a", false)), false))
    }

    // ---- new conversation, class team, periods

    @Test fun classTeacherOpensThreadWithoutSubject() {
        val a = listOf(StaffAssignment("c1", "class_teacher", null), StaffAssignment("c1", "subject_teacher", "math"))
        assertNull(threadSubjectId(a, "c1"))
    }

    @Test fun subjectTeacherOpensThreadUnderTheirSubject() {
        val a = listOf(StaffAssignment("c1", "subject_teacher", "math"), StaffAssignment("c2", "subject_teacher", "art"))
        assertEquals("art", threadSubjectId(a, "c2"))
        assertNull(threadSubjectId(a, "c9"))
    }

    @Test fun classTeamPairsSubjectsWithTeachers() {
        val rows = listOf(AssignmentRow("Rita", "class_teacher", null), AssignmentRow("Omar", "subject_teacher", "m"))
        val team = classTeam(rows, listOf(Subject("m", "Maths"), Subject("h", "Hindi")), listOf("m", "h"))
        assertEquals("Rita", team.classTeacher)
        assertEquals(listOf("Hindi" to null, "Maths" to "Omar"), team.subjects)
    }

    private fun entry(start: String, end: String, cover: String? = null) =
        DayEntry("teacher", "5-A", "P", 1, start, end, "S", cover)

    @Test fun periodStatuses() {
        val list = listOf(entry("08:00:00", "08:40:00"), entry("08:40:00", "09:20:00"), entry("09:20:00", "10:00:00"), entry("10:00:00", "10:40:00", "Ann"))
        val s = periodStatuses(list, "08:45").map { it.second }
        assertEquals(listOf(PeriodStatus.DONE, PeriodStatus.NOW, PeriodStatus.NEXT, PeriodStatus.COVER), s)
    }

    @Test fun nextPeriodIsTheRunningOrComingOne() {
        val list = listOf(entry("08:00:00", "08:40:00"), entry("09:00:00", "09:40:00"))
        assertEquals("09:00:00", nextPeriod(list, "08:45")?.startsAt)
        assertNull(nextPeriod(list, "10:00"))
    }

    @Test fun pickerMillisRoundTrip() {
        assertEquals("2026-11-05", StaffDates.fromPickerMillis(StaffDates.toPickerMillis("2026-11-05")))
    }
}
