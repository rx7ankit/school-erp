package tech.krevo.app.app

import androidx.compose.foundation.layout.Column
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import tech.krevo.app.R
import tech.krevo.app.design.Krevo

private class Tab(val route: String, val labelRes: Int, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.HOME, R.string.tab_home, Icons.Filled.Home),
    Tab(Routes.ATTENDANCE, R.string.tab_attendance, Icons.Filled.DateRange),
    Tab(Routes.RESULTS, R.string.tab_results, Icons.Filled.Star),
    Tab(Routes.MESSAGES, R.string.tab_messages, Icons.Filled.Email),
    Tab(Routes.MORE, R.string.tab_more, Icons.Filled.Menu),
)

fun navigateTab(nav: NavController, route: String) {
    nav.navigate(route) {
        popUpTo(Routes.HOME) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** Flat bottom bar. Orange only on the active tab. */
@Composable
fun KrevoBottomBar(route: String?, nav: NavController) {
    val c = Krevo.colors
    Column {
        HorizontalDivider(color = c.separator)
        NavigationBar(containerColor = c.bg, contentColor = c.text, tonalElevation = 0.dp) {
            tabs.forEach { tab ->
                NavigationBarItem(
                    selected = route == tab.route,
                    onClick = { if (route != tab.route) navigateTab(nav, tab.route) },
                    icon = { Icon(tab.icon, contentDescription = null) },
                    label = { Text(stringResource(tab.labelRes)) },
                    alwaysShowLabel = true,
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = c.accent,
                        selectedTextColor = c.accent,
                        indicatorColor = c.accentSubtle,
                        unselectedIconColor = c.textSecondary,
                        unselectedTextColor = c.textSecondary,
                    ),
                )
            }
        }
    }
}
