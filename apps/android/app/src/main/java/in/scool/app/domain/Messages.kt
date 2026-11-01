package `in`.scool.app.domain

data class Broadcast(
    val id: String,
    val subject: String,
    val teacher: String,
    val text: String,
    val attachment: String?,
    /** UTC ISO-8601 string. */
    val at: String,
)

data class MessageThread(
    val id: String,
    val teacher: String,
    /** e.g. "Class teacher" or "Mathematics". */
    val role: String,
    val lastMessage: String,
    /** UTC ISO-8601 string. */
    val lastAt: String,
)

data class ChatMessage(
    val id: String,
    val mine: Boolean,
    val from: String,
    val body: String,
    /** UTC ISO-8601 string. */
    val at: String,
)
