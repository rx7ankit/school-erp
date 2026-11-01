package `in`.scool.app.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import `in`.scool.app.data.Repository
import `in`.scool.app.design.LoadingBox
import `in`.scool.app.design.Scool
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.UserKind
import `in`.scool.app.features.attendance.AttendanceScreen
import `in`.scool.app.features.fees.FeesScreen
import `in`.scool.app.features.fees.InvoiceScreen
import `in`.scool.app.features.home.HomeScreen
import `in`.scool.app.features.login.LoginScreen
import `in`.scool.app.features.messages.ChatScreen
import `in`.scool.app.features.messages.MessagesScreen
import `in`.scool.app.features.more.MoreScreen
import `in`.scool.app.features.notices.NoticesScreen
import `in`.scool.app.features.password.ChangePasswordScreen
import `in`.scool.app.features.profile.ProfileScreen
import `in`.scool.app.features.results.ResultDetailScreen
import `in`.scool.app.features.results.ResultsScreen
import `in`.scool.app.features.settings.SettingsScreen
import `in`.scool.app.features.staff.StaffScreen

@Composable
fun ScoolApp(repository: Repository, session: SessionViewModel) {
    val nav = rememberNavController()
    val user by session.user.collectAsStateWithLifecycle()
    val child by session.selectedChild.collectAsStateWithLifecycle()
    val children by session.children.collectAsStateWithLifecycle()
    val mode by session.themeMode.collectAsStateWithLifecycle()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route

    // Route by session: signed out -> login, staff -> placeholder, temp password -> change password, else Home.
    LaunchedEffect(user?.id, user?.kind, user?.mustChangePassword) {
        val u = user
        val target = when {
            u == null -> Routes.LOGIN
            u.kind == UserKind.STAFF -> Routes.STAFF
            u.mustChangePassword -> Routes.changePassword(true)
            else -> Routes.HOME
        }
        val current = nav.currentBackStackEntry?.destination?.route
        val onAuthScreen = current == Routes.LOGIN || current == Routes.CHANGE_PASSWORD
        if (u == null && current != Routes.LOGIN || u != null && onAuthScreen) {
            nav.navigate(target) {
                popUpTo(nav.graph.id) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    Scaffold(
        containerColor = Scool.colors.bg,
        bottomBar = { if (route in Routes.tabs) ScoolBottomBar(route = route, nav = nav) },
    ) { inner ->
        NavHost(
            navController = nav,
            startDestination = Routes.LOGIN,
            modifier = Modifier.padding(inner).consumeWindowInsets(inner),
        ) {
            composable(Routes.LOGIN) { LoginScreen(repository, session) }
            composable(
                Routes.CHANGE_PASSWORD,
                arguments = listOf(navArgument("first") { type = NavType.BoolType }),
            ) { e ->
                val first = e.arguments?.getBoolean("first") ?: false
                ChangePasswordScreen(
                    first = first,
                    repository = repository,
                    onChanged = {
                        session.passwordChanged()
                        if (!first) nav.popBackStack()
                    },
                    showBack = !first,
                    onBack = { nav.popBackStack() },
                )
            }
            composable(Routes.STAFF) { StaffScreen(name = user?.name.orEmpty(), onSignOut = session::signOut) }

            // Everything below needs a selected child.
            composable(Routes.HOME) {
                WithChild(child) { c ->
                    HomeScreen(
                        child = c,
                        children = children,
                        repository = repository,
                        onSelectChild = session::selectChild,
                        onOpenAttendance = { navigateTab(nav, Routes.ATTENDANCE) },
                        onOpenResults = { navigateTab(nav, Routes.RESULTS) },
                        onOpenFees = { nav.navigate(Routes.FEES) },
                        onOpenNotices = { nav.navigate(Routes.NOTICES) },
                    )
                }
            }
            composable(Routes.ATTENDANCE) { WithChild(child) { AttendanceScreen(it, repository) } }
            composable(Routes.RESULTS) {
                WithChild(child) { ResultsScreen(it, repository, onOpen = { id -> nav.navigate(Routes.result(id)) }) }
            }
            composable(Routes.RESULT, arguments = listOf(navArgument("examId") { type = NavType.StringType })) { e ->
                ResultDetailScreen(
                    examId = e.arguments?.getString("examId").orEmpty(),
                    repository = repository,
                    onBack = { nav.popBackStack() },
                )
            }
            composable(Routes.MESSAGES) {
                WithChild(child) { MessagesScreen(it, repository, onOpenThread = { id -> nav.navigate(Routes.thread(id)) }) }
            }
            composable(Routes.THREAD, arguments = listOf(navArgument("threadId") { type = NavType.StringType })) { e ->
                WithChild(child) {
                    ChatScreen(
                        child = it,
                        threadId = e.arguments?.getString("threadId").orEmpty(),
                        repository = repository,
                        onBack = { nav.popBackStack() },
                    )
                }
            }
            composable(Routes.MORE) {
                MoreScreen(
                    onFees = { nav.navigate(Routes.FEES) },
                    onNotices = { nav.navigate(Routes.NOTICES) },
                    onProfile = { nav.navigate(Routes.PROFILE) },
                    onSettings = { nav.navigate(Routes.SETTINGS) },
                )
            }
            composable(Routes.FEES) {
                WithChild(child) { FeesScreen(it, repository, onOpen = { id -> nav.navigate(Routes.invoice(id)) }, onBack = { nav.popBackStack() }) }
            }
            composable(Routes.INVOICE, arguments = listOf(navArgument("invoiceId") { type = NavType.StringType })) { e ->
                WithChild(child) {
                    InvoiceScreen(
                        child = it,
                        invoiceId = e.arguments?.getString("invoiceId").orEmpty(),
                        repository = repository,
                        onBack = { nav.popBackStack() },
                    )
                }
            }
            composable(Routes.NOTICES) { NoticesScreen(repository, onBack = { nav.popBackStack() }) }
            composable(Routes.PROFILE) { WithChild(child) { ProfileScreen(it, onBack = { nav.popBackStack() }) } }
            composable(Routes.SETTINGS) {
                SettingsScreen(
                    mode = mode,
                    onModeChange = session::setThemeMode,
                    onChangePassword = { nav.navigate(Routes.changePassword(false)) },
                    onSignOut = session::signOut,
                    onBack = { nav.popBackStack() },
                )
            }
        }
    }
}

/** Shows [content] once a child is selected, a spinner until then. */
@Composable
private fun WithChild(child: Child?, content: @Composable (Child) -> Unit) {
    if (child == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { LoadingBox() }
    } else {
        Column(Modifier.fillMaxSize()) { content(child) }
    }
}
