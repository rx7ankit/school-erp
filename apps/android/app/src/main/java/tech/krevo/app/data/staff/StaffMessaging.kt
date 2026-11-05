package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.arr
import tech.krevo.app.data.int
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.str
import tech.krevo.app.domain.MessageAttachment

/** A private conversation between this teacher and one student's parents. */
data class StaffThread(
    val id: String,
    val studentName: String,
    val classLabel: String?,
    /** "Class teacher" or the subject. */
    val tag: String,
    val active: Boolean,
    val lastPreview: String,
    val lastAt: String,
    val unread: Int,
) {
    companion object {
        fun from(j: JSONObject) = StaffThread(
            id = j.getString("id"), studentName = j.str("student_name").orEmpty(), classLabel = j.str("class_label"),
            tag = j.str("tag").orEmpty(), active = j.optBoolean("active", true), lastPreview = j.str("last_message_preview").orEmpty(),
            lastAt = j.str("last_message_at").orEmpty(), unread = j.int("unread"),
        )
    }
}

data class StaffMessage(
    val id: String,
    val mine: Boolean,
    val senderName: String,
    val body: String,
    val createdAt: String,
    val attachments: List<MessageAttachment>,
) {
    companion object {
        fun from(j: JSONObject) = StaffMessage(
            id = j.getString("id"), mine = j.optBoolean("mine"), senderName = j.str("sender_name").orEmpty(), body = j.str("body").orEmpty(),
            createdAt = j.getString("created_at"),
            attachments = j.arr("attachments").mapObjects { a ->
                MessageAttachment(a.getString("id"), a.getString("filename"), a.getString("content_type"), a.optLong("size_bytes"))
            },
        )
    }
}
