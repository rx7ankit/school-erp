package tech.krevo.app.domain

enum class PasswordProblem { TOO_SHORT, NO_LETTER, NO_NUMBER }

object PasswordRules {
    /** Returns the first problem, or null when the password is acceptable. */
    fun check(password: String): PasswordProblem? = when {
        password.length < 8 -> PasswordProblem.TOO_SHORT
        password.none { it.isLetter() } -> PasswordProblem.NO_LETTER
        password.none { it.isDigit() } -> PasswordProblem.NO_NUMBER
        else -> null
    }
}
