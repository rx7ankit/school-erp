package tech.krevo.app.features.staff

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.ApiClient
import tech.krevo.app.data.staff.LiveStaffRepository
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffMe
import tech.krevo.app.data.staff.StaffRepository
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/**
 * Who is signed in on the staff side, and where their data comes from. Shared by every staff screen:
 * the classes (loaded once) and the number of leave requests waiting for a decision.
 */
class StaffState(val repo: StaffRepository, val me: StaffMe, val onSignOut: () -> Unit) {
    var classes: List<StaffClass> by mutableStateOf(emptyList())
        private set
    var pendingLeaves: Int by mutableIntStateOf(0)
    /** True while a chat is open: the bottom bar steps aside, as the chat has its own back button. */
    var chatOpen: Boolean by mutableStateOf(false)
    /** Unread messages from parents, for the badge on the Messages tab. */
    var unreadMessages: Int by mutableIntStateOf(0)

    /** Admins have no parent conversations; teachers do. */
    val hasMessages: Boolean get() = !me.isAdmin && me.assignments.isNotEmpty()

    suspend fun refreshUnreadMessages() {
        if (!hasMessages) { unreadMessages = 0; return }
        try { unreadMessages = repo.threads().sumOf { it.unread } } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    /** Classes this person may mark attendance for (all for admin, their own for a class teacher). */
    val markableClasses: List<StaffClass>
        get() {
            val ids = me.markableClassIds(classes.map { it.id })
            return classes.filter { it.id in ids }
        }

    /** Classes this person may send announcements to. */
    val announceClasses: List<StaffClass>
        get() = if (me.isAdmin) classes else classes.filter { c -> me.assignments.any { it.classId == c.id } }

    suspend fun loadClasses() {
        try { classes = repo.classes() } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    suspend fun refreshPendingLeaves() {
        if (!me.canMarkAttendance) { pendingLeaves = 0; return }
        try { pendingLeaves = repo.leaves("pending").size } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }
}

val LocalStaff = compositionLocalOf<StaffState> { error("StaffState not provided") }

internal enum class StaffTab(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Filled.Home),
    ATTENDANCE("Attendance", Icons.Filled.Done),
    STUDENTS("Students", Icons.Filled.Person),
    LEAVE("Leave", Icons.Filled.DateRange),
    MESSAGES("Messages", Icons.Filled.Email),
    MORE("More", Icons.Filled.Menu),
}

/**
 * Entry point of the staff app (teachers and admins), called with an already signed-in [api].
 * Admin sees everything. A class teacher gets Attendance and Leave. Any other teacher gets Home, Students and More.
 */
@Composable
fun StaffApp(api: ApiClient, name: String, onSignOut: () -> Unit) {
    val repo = remember(api) { LiveStaffRepository(api) }
    val meLoader = rememberLoader(repo) { repo.me() }
    val scope = rememberCoroutineScope()
    Box(Modifier.fillMaxSize()) {
        when (val s = meLoader.state) {
            is Ld.Ok -> StaffRoot(remember(s.value) { StaffState(repo, s.value, onSignOut) })
            is Ld.Failed -> Column(Modifier.padding(24.dp).padding(top = 48.dp)) {
                ErrorNote(s.message) { scope.launch { meLoader.run() } }
                PillButton(text = "Sign out", onClick = onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth())
            }
            Ld.Loading -> Column(Modifier.padding(24.dp).padding(top = 48.dp)) { StaffSkeleton(rows = 4) }
        }
    }
}

@Composable
private fun StaffRoot(state: StaffState) {
    val c = Krevo.colors
    val tabs = remember(state.me) {
        buildList {
            add(StaffTab.HOME)
            if (state.me.canMarkAttendance) add(StaffTab.ATTENDANCE)
            add(StaffTab.STUDENTS)
            if (state.me.canMarkAttendance) add(StaffTab.LEAVE)
            if (state.hasMessages) add(StaffTab.MESSAGES)
            add(StaffTab.MORE)
        }
    }
    var tabName by rememberSaveable { mutableStateOf(StaffTab.HOME.name) }
    val tab = StaffTab.valueOf(tabName).takeIf { it in tabs } ?: StaffTab.HOME

    LaunchedEffect(state) {
        state.loadClasses()
        state.refreshPendingLeaves()
        state.refreshUnreadMessages()
    }

    CompositionLocalProvider(LocalStaff provides state) {
        Scaffold(
            containerColor = c.bg,
            bottomBar = {
                if (!state.chatOpen) Column {
                    HorizontalDivider(color = c.separator)
                    NavigationBar(containerColor = c.bg, contentColor = c.text, tonalElevation = 0.dp) {
                        tabs.forEach { t ->
                            NavigationBarItem(
                                selected = t == tab,
                                onClick = { tabName = t.name },
                                icon = {
                                    val badge = when (t) { StaffTab.LEAVE -> state.pendingLeaves; StaffTab.MESSAGES -> state.unreadMessages; else -> 0 }
                                    if (badge > 0) {
                                        BadgedBox(badge = { Badge(containerColor = c.danger) { Text(badge.toString()) } }) { Icon(t.icon, contentDescription = null) }
                                    } else {
                                        Icon(t.icon, contentDescription = null)
                                    }
                                },
                                label = { Text(t.label) },
                                alwaysShowLabel = true,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = c.text, selectedTextColor = c.text, indicatorColor = c.fill,
                                    unselectedIconColor = c.textSecondary, unselectedTextColor = c.textSecondary,
                                ),
                            )
                        }
                    }
                }
            },
        ) { padding ->
            Box(Modifier.padding(padding).fillMaxSize()) {
                when (tab) {
                    StaffTab.HOME -> StaffHomeScreen(go = { tabName = it.name })
                    StaffTab.ATTENDANCE -> StaffAttendanceScreen()
                    StaffTab.STUDENTS -> StaffStudentsScreen()
                    StaffTab.LEAVE -> StaffLeaveScreen()
                    StaffTab.MESSAGES -> StaffMessagesScreen()
                    StaffTab.MORE -> StaffMoreScreen()
                }
            }
        }
    }
}
