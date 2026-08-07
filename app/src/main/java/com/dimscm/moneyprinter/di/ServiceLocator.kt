package com.dimscm.moneyprinter.di

import android.content.Context
import com.dimscm.moneyprinter.data.MoneyPrinterRepository
import com.dimscm.moneyprinter.data.TaskWatcher
import com.dimscm.moneyprinter.data.llm.LlmClient
import com.dimscm.moneyprinter.data.settings.SettingsRepository

/**
 * Hand-rolled dependency container. The graph is three objects deep, which is not worth a
 * DI framework and an annotation processor.
 */
object ServiceLocator {

    @Volatile
    private var initialised = false

    lateinit var settingsRepository: SettingsRepository
        private set

    lateinit var repository: MoneyPrinterRepository
        private set

    lateinit var taskWatcher: TaskWatcher
        private set

    @Synchronized
    fun init(context: Context) {
        if (initialised) return
        val appContext = context.applicationContext
        settingsRepository = SettingsRepository(appContext)
        repository = MoneyPrinterRepository(settingsRepository, LlmClient())
        taskWatcher = TaskWatcher(appContext, repository)
        initialised = true
    }
}
