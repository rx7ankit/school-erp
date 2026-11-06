package tech.krevo.app.app

import tech.krevo.app.design.PageSkeleton
import tech.krevo.app.features.messages.UpdatesScreen
import tech.krevo.app.features.leave.LeaveApplyScreen
import tech.krevo.app.features.leave.LeaveScreen
import tech.krevo.app.features.leave.leaveViewModel
import tech.krevo.app.features.leave.pendingCount
import tech.krevo.app.features.timetable.TimetableScreen
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import tech.krevo.app.features.notifications.NotificationsScreen
import kotlinx.coroutines.CancellationException
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import tech.krevo.app.R
import tech.krevo.app.design.PillButton
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
import tech.krevo.app.data.Repository
import tech.krevo.app.design.LoadingBox
import tech.krevo.app.design.Krevo
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.UserKind
import tech.krevo.app.features.attendance.AttendanceScreen
import tech.krevo.app.features.feedback.FeedbackRatingScreen
import tech.krevo.app.features.feedback.FeedbackScreen
import tech.krevo.app.features.feedback.feedbackViewModel
import tech.krevo.app.features.feedback.hasPending
import tech.krevo.app.features.fees.FeesScreen
import tech.krevo.app.features.fees.InvoiceScreen
import tech.krevo.app.features.home.HomeScreen
import tech.krevo.app.features.login.LoginScreen
import tech.krevo.app.features.messages.ChatScreen
import tech.krevo.app.features.messages.MessagesScreen
import tech.krevo.app.features.more.MoreScreen
import tech.krevo.app.features.notices.NoticesScreen
import tech.krevo.app.features.password.ChangePasswordScreen
import tech.krevo.app.features.profile.ProfileScreen
import tech.krevo.app.features.results.ResultDetailScreen
import tech.krevo.app.features.results.ResultsScreen
import tech.krevo.app.features.settings.SettingsScreen

@Composable
fun KrevoApp(repository: Repository, api: tech.krevo.app.data.ApiClient, session: SessionViewModel) {
    val nav = rememberNavController()
    val user by session.user.collectAsStateWithLifecycle()
    val child by session.selectedChild.collectAsStateWithLifecycle()
    val children by session.children.collectAsStateWithLifecycle()
    val language by session.language.collectAsStateWithLifecycle()
    val notificationSettings by session.notificationSettings.collectAsStateWithLifecycle()
    val dismissedPromotions by session.dismissedPromotions.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val askNotificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val boot by session.boot.collectAsStateWithLifecycle()

    // Route by session: signed out -> login, staff -> placeholder, temp password -> change password, else Home.
    LaunchedEffect(user?.id, user?.kind, user?.mustChangePassword, boot) {
        if (boot != SessionViewModel.Boot.READY) return@LaunchedEffect   // the nav graph is not built yet
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

    // After login: ask for the notification permission (Android 13+) and register this device for push.
    LaunchedEffect(user?.id, user?.mustChangePassword) {
        val u = user
        if (u == null || u.kind != UserKind.PARENT || u.mustChangePassword) return@LaunchedEffect
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        try {
            repository.registerDevice(PushSetup.deviceToken(), PushSetup.PLATFORM)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // Push is optional; the app works without it.
        }
    }

    // Launching with a saved sign-in: splash while it is checked, or a retry screen if the server cannot be reached.
    if (boot != SessionViewModel.Boot.READY) {
        RestoreScreen(offline = boot == SessionViewModel.Boot.OFFLINE, onRetry = session::restore)
        return
    }

    Scaffold(
        containerColor = Krevo.colors.bg,
        bottomBar = { if (route in Routes.tabs) KrevoBottomBar(route = route, nav = nav) },
    ) { inner ->
        NavHost(
            navController = nav,
            // Already signed in (restored): open straight into the app instead of flashing the login screen.
            startDestination = when {
                user == null -> Routes.LOGIN
                user?.kind == UserKind.STAFF -> Routes.STAFF
                else -> Routes.HOME
            },
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
            composable(Routes.STAFF) { tech.krevo.app.features.staff.StaffApp(api = api, name = user?.name.orEmpty(), onSignOut = session::signOut) }

            // Everything below needs a selected child.
            composable(Routes.HOME) {
                WithChild(child) { c ->
                    HomeScreen(
                        child = c,
                        children = children,
                        repository = repository,
                        onSelectChild = session::selectChild,
                        onOpenAttendance = { navigateTab(nav, Routes.ATTENDANCE) },
                        onOpenTimetable = { nav.navigate(Routes.TIMETABLE) },
                        onOpenResults = { navigateTab(nav, Routes.RESULTS) },
                        onOpenFees = { nav.navigate(Routes.FEES) },
                        onOpenMessages = { navigateTab(nav, Routes.MESSAGES) },
                        onOpenNotifications = { nav.navigate(Routes.NOTIFICATIONS) },
                        onOpenFeedback = { nav.navigate(Routes.FEEDBACK) },
                        dismissedPromotions = dismissedPromotions,
                        onDismissPromotion = session::dismissPromotion,
                    )
                }
            }
            composable(Routes.ATTENDANCE) { WithChild(child) { AttendanceScreen(it, repository) } }
            composable(Routes.RESULTS) {
                WithChild(child) { ResultsScreen(it, repository, onOpen = { id -> nav.navigate(Routes.result(id)) }) }
            }
            composable(Routes.RESULT, arguments = listOf(navArgument("examId") { type = NavType.StringType })) { e ->
                WithChild(child) {
                    ResultDetailScreen(
                        child = it,
                        examId = e.arguments?.getString("examId").orEmpty(),
                        repository = repository,
                        onBack = { nav.popBackStack() },
                    )
                }
            }
            composable(Routes.MESSAGES) {
                WithChild(child) { MessagesScreen(
                        it, repository,
                        onOpenUpdates = { nav.navigate(Routes.UPDATES) },
                        onOpenThread = { id -> nav.navigate(Routes.thread(id)) },
                    ) }
            }
            composable(Routes.UPDATES) {
                WithChild(child) { UpdatesScreen(it, repository, onBack = { nav.popBackStack() }) }
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
                WithChild(child) { c ->
                    val feedback by feedbackViewModel(repository, c.id).state.collectAsStateWithLifecycle()
                    val leave by leaveViewModel(repository, c.id).state.collectAsStateWithLifecycle()
                    MoreScreen(
                        feedbackPending = feedback.hasPending(),
                        leavePending = leave.pendingCount(),
                        onLeave = { nav.navigate(Routes.LEAVE) },
                        onTimetable = { nav.navigate(Routes.TIMETABLE) },
                        onFees = { nav.navigate(Routes.FEES) },
                        onNotices = { nav.navigate(Routes.NOTICES) },
                        onFeedback = { nav.navigate(Routes.FEEDBACK) },
                        onProfile = { nav.navigate(Routes.PROFILE) },
                        onSettings = { nav.navigate(Routes.SETTINGS) },
                    )
                }
            }
            composable(Routes.LEAVE) {
                WithChild(child) { LeaveScreen(it, repository, onApply = { nav.navigate(Routes.LEAVE_APPLY) }, onBack = { nav.popBackStack() }) }
            }
            composable(Routes.LEAVE_APPLY) {
                WithChild(child) { LeaveApplyScreen(it, repository, onDone = { nav.popBackStack() }, onBack = { nav.popBackStack() }) }
            }
            composable(Routes.TIMETABLE) {
                WithChild(child) { TimetableScreen(it, repository, onBack = { nav.popBackStack() }) }
            }
            composable(Routes.FEEDBACK) {
                WithChild(child) {
                    FeedbackScreen(it, repository, onOpen = { id -> nav.navigate(Routes.feedbackRequest(id)) }, onBack = { nav.popBackStack() })
                }
            }
            composable(Routes.FEEDBACK_REQUEST, arguments = listOf(navArgument("requestId") { type = NavType.StringType })) { e ->
                WithChild(child) {
                    FeedbackRatingScreen(
                        child = it,
                        requestId = e.arguments?.getString("requestId").orEmpty(),
                        repository = repository,
                        onBack = { nav.popBackStack() },
                    )
                }
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
            composable(Routes.NOTICES) { WithChild(child) { NoticesScreen(it, repository, onBack = { nav.popBackStack() }) } }
            composable(Routes.NOTICES_EXAMS) {
                WithChild(child) { NoticesScreen(it, repository, initialTab = 2, onBack = { nav.popBackStack() }) }
            }
            composable(Routes.NOTIFICATIONS) {
                WithChild(child) {
                    NotificationsScreen(
                        child = it,
                        repository = repository,
                        onOpen = { n ->
                            // A notification for a sibling switches the whole app to that child first.
                            if (n.childId != it.id) session.selectChild(n.childId)
                            if (n.deepLink in Routes.tabs) navigateTab(nav, n.deepLink) else nav.navigate(n.deepLink)
                        },
                        onBack = { nav.popBackStack() },
                    )
                }
            }
            composable(Routes.PROFILE) { WithChild(child) { ProfileScreen(it, onBack = { nav.popBackStack() }) } }
            composable(Routes.SETTINGS) {
                SettingsScreen(
                    language = language,
                    onLanguageChange = session::setLanguage,
                    notifications = notificationSettings,
                    onNotificationChange = session::setNotificationEnabled,
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
        PageSkeleton()
    } else {
        Column(Modifier.fillMaxSize()) { content(child) }
    }
}

/** Shown at launch while a saved sign-in is checked with the server, or when it could not be reached. */
@Composable
private fun RestoreScreen(offline: Boolean, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Krevo.colors.bg).padding(32.dp), contentAlignment = Alignment.Center) {
        if (!offline) {
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineLarge, color = Krevo.colors.text)
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    stringResource(R.string.offline_title), style = MaterialTheme.typography.titleLarge,
                    color = Krevo.colors.text, textAlign = TextAlign.Center,
                )
                Text(
                    stringResource(R.string.offline_body), style = MaterialTheme.typography.bodyLarge,
                    color = Krevo.colors.textSecondary, textAlign = TextAlign.Center,
                )
                PillButton(text = stringResource(R.string.try_again), onClick = onRetry, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }
}
