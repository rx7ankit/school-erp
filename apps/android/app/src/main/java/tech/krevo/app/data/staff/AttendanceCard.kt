package tech.krevo.app.data.staff

/** What the "My attendance" card on Home shows for a class teacher. */
sealed interface AttendanceCard {
    /** Not a class teacher of any class: the card is hidden. */
    data object NothingToMark : AttendanceCard
    /** A Sunday or holiday; [reason] is the holiday's name or "Sunday". */
    data class NoSchool(val reason: String) : AttendanceCard
    data object AllMarked : AttendanceCard
    /** [classes] are the ones still to mark today. */
    data class ToMark(val classes: List<ClassDay>) : AttendanceCard
}

/** Why there is no school today: the holiday's name, or "Sunday"; null on a school day. */
fun noSchoolReason(holiday: String?, isSunday: Boolean): String? = holiday ?: if (isSunday) "Sunday" else null

/**
 * Works out the card from the classes I am class teacher of and today's overview. No attendance is taken on a Sunday or
 * a holiday, unless one of my classes was marked anyway.
 */
fun attendanceCard(myClassIds: Set<String>, overview: DayOverview, isSunday: Boolean): AttendanceCard {
    val mine = overview.classes.filter { it.classId in myClassIds }
    if (mine.isEmpty()) return AttendanceCard.NothingToMark
    val off = noSchoolReason(overview.holiday, isSunday)
    if (off != null && mine.none { it.marked }) return AttendanceCard.NoSchool(off)
    val unmarked = mine.filter { !it.marked }
    return if (unmarked.isEmpty()) AttendanceCard.AllMarked else AttendanceCard.ToMark(unmarked)
}
