package `in`.scool.app.domain

/**
 * Text that is resolved to a string only when it is shown, so it follows the active language.
 * [Res.id] is an Android string resource id; [Raw] is text that came from the server and is shown as given.
 */
sealed interface UiText {
    data class Raw(val value: String) : UiText
    data class Res(val id: Int, val args: List<Any> = emptyList()) : UiText
}

/** What can go wrong in a way the parent should read about. The app layer maps each code to a string resource. */
enum class AppError {
    WRONG_LOGIN,
    SIGN_IN_AGAIN,
    RESULT_NOT_FOUND,
    EMPTY_MESSAGE,
    FEEDBACK_CLOSED,
    FEEDBACK_ALREADY_SENT,
    FEEDBACK_NEEDS_STAR,
    LEAVE_DATES,
    LEAVE_IN_PAST,
    LEAVE_REASON_REQUIRED,
    LEAVE_REASON_TOO_LONG,
    LEAVE_HALF_SINGLE_DAY,
    LEAVE_NOT_PENDING,
    LEAVE_CHILD_LEFT,
}

class AppException(val error: AppError) : Exception(error.name)
