package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.ApiClient
import tech.krevo.app.data.staff.HomeLayout
import tech.krevo.app.data.staff.LiveStaffRepository
import tech.krevo.app.data.staff.NoticeReads
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffMe
import tech.krevo.app.data.staff.StaffRepository
import tech.krevo.app.design.ButtonKind
import androidx.compose.ui.graphics.Color
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/**
 * Who is signed in on the staff side, and where their data comes from. Shared by every staff screen: the person, the
 * layout the server chose for them, the classes (loaded once), the counts behind the badges, and the stack of pushed pages.
 */
class StaffState(val repo: StaffRepository, me: StaffMe, val onSignOut: () -> Unit) {
    var me: StaffMe by mutableStateOf(me)
        private set
    private var serverLayout: HomeLayout? by mutableStateOf(null)
    var classes: List<StaffClass> by mutableStateOf(emptyList())
        private set
    var pendingLeaves: Int by mutableIntStateOf(0)
    /** Unread messages from parents, for the badge on the Messages tab. */
    var unreadMessages: Int by mutableIntStateOf(0)

    /** Pushed pages above the tab that is showing. The bottom bar is hidden while there is one. */
    val stack = mutableStateListOf<StaffDest>()
    /** Counts up whenever a pushed page closes, so the page underneath loads again (attendance may just have been saved). */
    var refresh: Int by mutableIntStateOf(0)
        private set

    /** The server's layout, or one worked out from the permissions until it arrives (or if it cannot be fetched). */
    val layout: HomeLayout
        get() = serverLayout ?: HomeLayout.fallback(me.permissions, me.assignments.isNotEmpty())

    fun push(dest: StaffDest) { stack.add(dest) }
    fun back() {
        if (stack.isNotEmpty()) { stack.removeAt(stack.lastIndex); refresh++ }
    }
    /** Swaps the page on top for another (a new conversation becomes the chat). */
    fun replaceTop(dest: StaffDest) {
        if (stack.isNotEmpty()) stack[stack.lastIndex] = dest else stack.add(dest)
    }

    /** Classes this person may send announcements to: any class with Announcements access, else the ones they teach. */
    val announceClasses: List<StaffClass>
        get() = if (me.canAnnounce) classes else classes.filter { c -> me.assignments.any { it.classId == c.id } }

    /** The class with this id, or a stand-in carrying just its label while the list is still loading. */
    fun classFor(id: String, label: String): StaffClass = classes.firstOrNull { it.id == id } ?: StaffClass(id, label, "", 0, emptyList())

    suspend fun loadLayout() {
        try { serverLayout = repo.homeLayout() } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    /** Reloads who I am: photo and logo links expire, and my permissions may just have changed. */
    suspend fun refreshMe() {
        try { me = repo.me() } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    /** Saves a new photo, or removes it when [jpeg] is null, then reloads who I am. */
    suspend fun setPhoto(jpeg: ByteArray?) {
        repo.setPhoto(jpeg)
        refreshMe()
    }

    suspend fun loadClasses() {
        try { classes = repo.classes() } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    suspend fun refreshPendingLeaves() {
        if (!me.canDecideLeave) { pendingLeaves = 0; return }
        try { pendingLeaves = repo.leaves("pending").size } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    suspend fun refreshUnreadMessages() {
        try { unreadMessages = repo.threads().sumOf { it.unread } } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }
}

val LocalStaff = compositionLocalOf<StaffState> { error("StaffState not provided") }

/** Which notices this person has opened (for the New chip). */
val LocalNoticeReads = compositionLocalOf<NoticeReads> { error("NoticeReads not provided") }

/**
 * Entry point of the staff app (teachers and people with permissions), called with an already signed-in [api].
 */
@Composable
fun StaffApp(api: ApiClient, onSignOut: () -> Unit) {
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

/** The staff app. The bottom bar comes from the server's layout; pushed pages cover it. */
@Composable
private fun StaffRoot(state: StaffState) {
    val c = Krevo.colors
    val context = androidx.compose.ui.platform.LocalContext.current
    val tabs = state.layout.tabs.mapNotNull { key -> StaffTab.entries.firstOrNull { it.key == key } }
    var tabName by rememberSaveable { mutableStateOf(StaffTab.HOME.name) }
    val tab = StaffTab.valueOf(tabName).takeIf { it in tabs } ?: StaffTab.HOME

    LaunchedEffect(state) {
        state.loadLayout()
        state.loadClasses()
        state.refreshPendingLeaves()
        state.refreshUnreadMessages()
    }
    // Unread counts move while a page is open (a chat marks its thread read), so refresh them when it closes.
    LaunchedEffect(state.refresh) {
        if (state.refresh > 0) { state.refreshPendingLeaves(); state.refreshUnreadMessages() }
    }
    BackHandler(enabled = state.stack.isNotEmpty()) { state.back() }

    val noticeReads = remember(state.me.id) { NoticeReads(context, state.me.id) }
    CompositionLocalProvider(LocalStaff provides state, LocalNoticeReads provides noticeReads) {
      Box(Modifier.fillMaxSize().background(c.bg)) {
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = {
                if (state.stack.isEmpty()) Column {
                    HorizontalDivider(color = c.separator)
                    NavigationBar(containerColor = c.bg, contentColor = c.text, tonalElevation = 0.dp) {
                        tabs.forEach { t ->
                            NavigationBarItem(
                                selected = t == tab,
                                onClick = { tabName = t.name },
                                icon = {
                                    val badge = when (t) { StaffTab.ACADEMIC -> state.pendingLeaves; StaffTab.MESSAGES -> state.unreadMessages; else -> 0 }
                                    if (badge > 0) {
                                        BadgedBox(badge = { Badge(containerColor = c.accent, contentColor = c.onAccent) { Text(badge.toString()) } }) { Icon(t.icon, contentDescription = null) }
                                    } else {
                                        Icon(t.icon, contentDescription = null)
                                    }
                                },
                                label = { Text(t.label) },
                                alwaysShowLabel = true,
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = c.accent, selectedTextColor = c.accent, indicatorColor = c.accentSubtle,
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
                    StaffTab.MESSAGES -> StaffMessagesScreen()
                    StaffTab.ACADEMIC -> StaffAcademicScreen()
                    StaffTab.FEES -> StaffFeesScreen()
                    StaffTab.LIBRARY -> StaffLibraryScreen()
                }
                state.stack.lastOrNull()?.let { dest ->
                    // Swallows touches, so nothing underneath answers while a pushed page covers it.
                    Box(Modifier.fillMaxSize().background(c.bg).pointerInput(Unit) {}) {
                                        key(state.stack.size, dest) { StaffDestination(dest) }
                    }
                }
            }
        }
      }
    }
}
