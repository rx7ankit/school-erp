package `in`.scool.app.app

object Routes {
    const val LOGIN = "login"
    const val CHANGE_PASSWORD = "change_password/{first}"
    const val STAFF = "staff"

    const val HOME = "home"
    const val ATTENDANCE = "attendance"
    const val RESULTS = "results"
    const val RESULT = "results/{examId}"
    const val MESSAGES = "messages"
    const val THREAD = "thread/{threadId}"
    const val MORE = "more"

    const val FEES = "fees"
    const val INVOICE = "fees/{invoiceId}"
    const val NOTICES = "notices"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"

    fun changePassword(first: Boolean) = "change_password/$first"
    fun result(id: String) = "results/$id"
    fun thread(id: String) = "thread/$id"
    fun invoice(id: String) = "fees/$id"

    val tabs = listOf(HOME, ATTENDANCE, RESULTS, MESSAGES, MORE)
}
