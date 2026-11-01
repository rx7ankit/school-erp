package `in`.scool.app.domain

object PasswordRules {
    const val HINT = "At least 8 characters, with a letter and a number."

    /** Returns an error message, or null when the password is acceptable. */
    fun check(password: String): String? = when {
        password.length < 8 -> "Use at least 8 characters."
        password.none { it.isLetter() } -> "Add at least one letter."
        password.none { it.isDigit() } -> "Add at least one number."
        else -> null
    }
}
