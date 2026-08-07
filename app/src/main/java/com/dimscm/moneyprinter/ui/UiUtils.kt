package com.dimscm.moneyprinter.ui

import android.content.Context
import com.dimscm.moneyprinter.R
import com.dimscm.moneyprinter.data.ServerNotConfiguredException
import com.dimscm.moneyprinter.data.remote.TaskStatus
import retrofit2.HttpException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/** Turns whatever blew up into something worth showing in a snackbar. */
fun Throwable.userMessage(context: Context): String = when (this) {
    is ServerNotConfiguredException -> context.getString(R.string.msg_no_server)
    is HttpException -> "HTTP ${code()} — ${response()?.errorBody()?.string().orEmpty().take(200).ifBlank { message() }}"
    is UnknownHostException -> "Host not found: ${message.orEmpty()}"
    is ConnectException -> "Connection refused: ${message.orEmpty()}"
    is SocketTimeoutException -> "Connection timed out"
    else -> message ?: this::class.java.simpleName
}

fun stateLabel(context: Context, state: Int): String = when (state) {
    TaskStatus.STATE_COMPLETE -> context.getString(R.string.state_complete)
    TaskStatus.STATE_FAILED -> context.getString(R.string.state_failed)
    TaskStatus.STATE_PROCESSING -> context.getString(R.string.state_processing)
    else -> context.getString(R.string.state_unknown)
}
