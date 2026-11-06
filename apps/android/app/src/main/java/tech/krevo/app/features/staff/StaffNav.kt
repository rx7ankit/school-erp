package tech.krevo.app.features.staff

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import tech.krevo.app.data.staff.Broadcast
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffMember
import tech.krevo.app.data.staff.StudentItem

/** The tabs of the bottom bar. [key] is the name the server uses for it in `GET /home/layout`. */
internal enum class StaffTab(val key: String, val label: String, val icon: ImageVector) {
    HOME("home", "Home", Icons.Filled.Home),
    MESSAGES("messages", "Messages", Icons.Filled.Email),
    ACADEMIC("academic", "Academic", StaffIcons.Academic),
    FEES("fees", "Fees", StaffIcons.Fees),
    LIBRARY("library", "Library", StaffIcons.Library),
}

/** A page pushed above a tab: it has a back arrow and the bottom bar steps aside. */
sealed interface StaffDest {
    data object Classes : StaffDest
    data class ClassPage(val cls: StaffClass, val day: String) : StaffDest
    data class AttendanceSheet(val cls: StaffClass, val day: String) : StaffDest
    data object Students : StaffDest
    data class Student(val item: StudentItem) : StaffDest
    data object Leave : StaffDest
    data object Timetable : StaffDest
    data object Notices : StaffDest
    data class Notice(val notice: Broadcast) : StaffDest
    data object People : StaffDest
    data class Person(val member: StaffMember) : StaffDest
    data object AddPerson : StaffDest
    data object NewConversation : StaffDest
    data class Chat(val threadId: String) : StaffDest
}

@Composable
internal fun StaffDestination(dest: StaffDest) {
    val staff = LocalStaff.current
    val back = staff::back
    when (dest) {
        StaffDest.Classes -> StaffClassesScreen(onBack = back)
        is StaffDest.ClassPage -> StaffClassScreen(dest.cls, dest.day, onBack = back)
        is StaffDest.AttendanceSheet -> AttendanceSheetScreen(dest.cls, dest.day, onBack = back)
        StaffDest.Students -> StaffStudentsScreen(onBack = back)
        is StaffDest.Student -> StudentDetailScreen(dest.item, onBack = back)
        StaffDest.Leave -> StaffLeaveScreen(onBack = back)
        StaffDest.Timetable -> StaffTimetableScreen(onBack = back)
        StaffDest.Notices -> StaffNoticesScreen(onBack = back)
        is StaffDest.Notice -> StaffNoticeScreen(dest.notice, onBack = back)
        StaffDest.People -> StaffPeopleScreen(onBack = back)
        is StaffDest.Person -> StaffPersonScreen(dest.member, onBack = back)
        StaffDest.AddPerson -> StaffAddPersonScreen(onBack = back)
        StaffDest.NewConversation -> StaffNewConversationScreen(onBack = back)
        is StaffDest.Chat -> StaffChat(dest.threadId, onBack = back)
    }
}
