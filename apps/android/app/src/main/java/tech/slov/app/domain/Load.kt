package tech.slov.app.domain

/** Simple screen state for anything loaded from the repository. */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Error(val message: UiText) : Load<Nothing>
    data class Data<T>(val value: T) : Load<T>
}
