package com.dimscm.moneyprinter.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.ui.create.CreateScreen
import com.dimscm.moneyprinter.ui.detail.TaskDetailScreen
import com.dimscm.moneyprinter.ui.settings.SettingsScreen
import com.dimscm.moneyprinter.ui.tasks.TasksScreen

private object Routes {
    const val CREATE = "create"
    const val TASKS = "tasks"
    const val SETTINGS = "settings"
    const val TASK_DETAIL = "task/{taskId}"

    fun taskDetail(taskId: String) = "task/$taskId"
}

private data class BottomDestination(
    val route: String,
    val icon: ImageVector,
    val labelRes: Int,
)

private val bottomDestinations = listOf(
    BottomDestination(Routes.CREATE, Icons.Filled.AddCircle, R.string.nav_create),
    BottomDestination(Routes.TASKS, Icons.Filled.VideoLibrary, R.string.nav_tasks),
    BottomDestination(Routes.SETTINGS, Icons.Filled.Settings, R.string.nav_settings),
)

@Composable
fun AppRoot() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            if (currentRoute != Routes.TASK_DETAIL) {
                NavigationBar {
                    bottomDestinations.forEach { destination ->
                        NavigationBarItem(
                            selected = currentRoute == destination.route,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = null) },
                            label = { Text(stringResource(destination.labelRes)) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.CREATE,
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.CREATE) {
                CreateScreen(
                    onTaskCreated = { taskId -> navController.navigate(Routes.taskDetail(taskId)) },
                    onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                )
            }
            composable(Routes.TASKS) {
                TasksScreen(
                    onOpenTask = { taskId -> navController.navigate(Routes.taskDetail(taskId)) },
                )
            }
            composable(Routes.SETTINGS) {
                SettingsScreen()
            }
            composable(
                route = Routes.TASK_DETAIL,
                arguments = listOf(navArgument("taskId") { type = NavType.StringType }),
            ) { entry ->
                TaskDetailScreen(
                    taskId = entry.arguments?.getString("taskId").orEmpty(),
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
