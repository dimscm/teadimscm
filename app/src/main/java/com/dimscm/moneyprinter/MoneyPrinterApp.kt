package com.dimscm.moneyprinter

import android.app.Application
import com.dimscm.moneyprinter.di.ServiceLocator

class MoneyPrinterApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
    }
}
