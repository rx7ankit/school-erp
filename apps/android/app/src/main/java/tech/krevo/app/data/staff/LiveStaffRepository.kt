package tech.krevo.app.data.staff

import org.json.JSONArray
import org.json.JSONObject
import tech.krevo.app.data.ApiClient
import tech.krevo.app.data.arr
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.str

private const val NOTICE_PAGE = 20

/** The real backend. One method per screen need, each a single API call. */
class LiveStaffRepository(private val api: ApiClient) : StaffRepository {
    override suspend fun me() = StaffMe.from(api.getObject("/auth/me"))
    override suspend fun homeLayout() = HomeLayout.from(api.getObject("/home/layout"))

    /** Four steps, like a chat attachment: ask for a link, send the bytes, confirm, then make it this person's photo. */
    override suspend fun setPhoto(jpeg: ByteArray?) {
        if (jpeg == null) {
            api.send("PUT", "/auth/me/photo", JSONObject().put("file_id", JSONObject.NULL))
            return
        }
        val id = upload(jpeg, "photo.jpg", "image/jpeg", "staff_photo")
        api.send("PUT", "/auth/me/photo", JSONObject().put("file_id", id))
    }

    override suspend fun dashboard() = StaffDashboard.from(api.getObject("/dashboard"))

    override suspend fun classes(): List<StaffClass> =
        api.getObject("/academic/classes").arr("items").mapObjects { StaffClass.from(it) }
            .sortedWith(compareBy({ order(it.grade) }, { it.grade }, { it.section }))

    /** LKG and UKG come before class 1. */
    private fun order(grade: String): Int = when (grade.uppercase()) {
        "NURSERY" -> -3
        "LKG" -> -2
        "UKG" -> -1
        else -> grade.toIntOrNull() ?: 99
    }

    override suspend fun dayOverview(day: String) = DayOverview.from(api.getObject("/attendance/overview", mapOf("day_on" to day)))

    override suspend fun assignments(classId: String) =
        api.getObject("/academic/assignments", mapOf("class_id" to classId)).arr("items").mapObjects { AssignmentRow.from(it) }

    override suspend fun subjects() =
        api.getObject("/academic/subjects").arr("items").mapObjects { Subject(it.getString("id"), it.str("name").orEmpty()) }

    override suspend fun attendanceSheet(classId: String, day: String) =
        AttendanceSheet.from(api.getObject("/attendance/classes/$classId/sheet", mapOf("day_on" to day)))

    override suspend fun saveAttendance(classId: String, day: String, students: List<SheetStudent>): AttendanceSheet {
        val records = JSONArray()
        students.forEach {
            records.put(
                JSONObject().put("student_id", it.studentId).put("first_half", it.firstHalf.wire)
                    .put("second_half", it.secondHalf.wire).put("late", it.late),
            )
        }
        return AttendanceSheet.from(api.send("PUT", "/attendance/classes/$classId/days/$day", JSONObject().put("records", records)) as JSONObject)
    }

    override suspend fun attendanceInsight(days: Int): AttendanceInsight {
        val to = StaffDates.today()
        return AttendanceInsight.from(
            api.getObject("/analytics/attendance", mapOf("from_on" to StaffDates.addDays(to, -(days - 1)), "to_on" to to)),
        )
    }

    override suspend fun students(query: String, classId: String?, offset: Int): Page<StudentItem> {
        val j = api.getObject(
            "/students",
            mapOf("q" to query.ifEmpty { null }, "class_id" to classId, "limit" to "40", "offset" to offset.toString()),
        )
        return Page(j.arr("items").mapObjects { StudentItem.from(it) }, j.optInt("total"))
    }

    override suspend fun student(id: String) = StudentDetail.from(api.getObject("/students/$id"))

    override suspend fun leaves(status: String?) =
        api.getObject("/leave", mapOf("status" to status, "limit" to "100")).arr("items").mapObjects { StaffLeave.from(it) }

    override suspend fun decideLeave(id: String, approve: Boolean, note: String): StaffLeave {
        val body = JSONObject().put("decision", if (approve) "approve" else "reject")
        if (note.isNotBlank()) body.put("note", note.trim())
        return StaffLeave.from(api.send("POST", "/leave/$id/decision", body) as JSONObject)
    }

    override suspend fun myDay(on: String) =
        api.getObject("/timetable/me/day", mapOf("on" to on)).arr("entries").mapObjects { DayEntry.from(it) }

    override suspend fun broadcasts() =
        api.getObject("/messaging/broadcasts", mapOf("limit" to "30")).arr("items").mapObjects { Broadcast.from(it) }

    override suspend fun broadcastPage(offset: Int): Page<Broadcast> {
        val j = api.getObject("/messaging/broadcasts", mapOf("limit" to NOTICE_PAGE.toString(), "offset" to offset.toString()))
        return Page(j.arr("items").mapObjects { Broadcast.from(it) }, j.optInt("total"))
    }

    override suspend fun postBroadcast(title: String, body: String, classId: String?, attachmentIds: List<String>): Broadcast {
        val j = JSONObject().put("title", title).put("body", body).put("audience", "all")
            .put("scope", if (classId == null) "school" else "class").put("attachment_ids", JSONArray(attachmentIds))
        if (classId != null) j.put("class_id", classId)
        return Broadcast.from(api.send("POST", "/messaging/broadcasts", j) as JSONObject)
    }

    override suspend fun staff(query: String) =
        api.getObject("/staff", mapOf("q" to query.ifEmpty { null })).arr("items").mapObjects { StaffMember.from(it) }

    override suspend fun accessOptions() = AccessOptions.from(api.getObject("/staff/access-options"))

    override suspend fun setPermissions(staffId: String, permissions: List<String>) =
        StaffMember.from(api.send("PUT", "/staff/$staffId/permissions", JSONObject().put("permissions", JSONArray(permissions))) as JSONObject)

    override suspend fun addStaff(name: String, email: String, designation: String, permissions: List<String>, sendLogin: Boolean) =
        StaffMember.from(
            api.send(
                "POST", "/staff",
                JSONObject().put("name", name).put("email", email).put("designation", designation)
                    .put("permissions", JSONArray(permissions)).put("send_login", sendLogin),
            ) as JSONObject,
        )

    override suspend fun sendLogin(staffId: String) { api.send("POST", "/staff/$staffId/send-login") }

    override suspend fun librarySummary() = LibrarySummary.from(api.getObject("/library/summary"))

    override suspend fun books(query: String, offset: Int): Page<LibraryBook> {
        val j = api.getObject("/library/books", mapOf("q" to query.ifEmpty { null }, "limit" to "30", "offset" to offset.toString()))
        return Page(j.arr("items").mapObjects { LibraryBook.from(it) }, j.optInt("total"))
    }

    override suspend fun overdueLoans() =
        api.getObject("/library/overdue", mapOf("limit" to "5", "offset" to "0")).arr("items").mapObjects { LibraryLoan.from(it) }

    override suspend fun feesSummary() = FeesSummary.from(api.getObject("/analytics/fees"))

    override suspend fun dues(query: String) =
        api.getObject("/fees/reports/dues", mapOf("q" to query.ifEmpty { null }, "limit" to "40", "offset" to "0"))
            .arr("items").mapObjects { DueRow.from(it) }

    // ---- messaging ------------------------------------------------------------------------------------------------

    override suspend fun threads() =
        api.getObject("/messaging/threads", mapOf("limit" to "100")).arr("items").mapObjects { StaffThread.from(it) }
            .sortedByDescending { it.lastAt }

    override suspend fun threadMessages(threadId: String): List<StaffMessage> {
        val page = api.getObject("/messaging/threads/$threadId/messages", mapOf("limit" to "100"))
        try { api.send("POST", "/messaging/threads/$threadId/read") } catch (_: Exception) { }
        return page.arr("items").mapObjects { StaffMessage.from(it) }.sortedBy { it.createdAt }
    }

    override suspend fun openThread(studentId: String, subjectId: String?): String {
        val body = JSONObject().put("student_id", studentId).put("subject_id", subjectId ?: JSONObject.NULL)
        return (api.send("POST", "/messaging/threads", body) as JSONObject).getString("id")
    }

    override suspend fun sendMessage(threadId: String, text: String, attachmentIds: List<String>): StaffMessage {
        val body = JSONObject().put("body", text.trim()).put("attachment_ids", org.json.JSONArray(attachmentIds))
        return StaffMessage.from(api.send("POST", "/messaging/threads/$threadId/messages", body) as JSONObject)
    }

    override suspend fun uploadAttachment(bytes: ByteArray, filename: String, contentType: String) =
        upload(bytes, filename, contentType, "message_attachment")

    /** Three steps: ask for an upload link, send the bytes to it, tell the school the file is complete. Returns the file id. */
    private suspend fun upload(bytes: ByteArray, filename: String, contentType: String, purpose: String): String {
        val start = api.send(
            "POST", "/files/upload-url",
            JSONObject().put("filename", filename).put("content_type", contentType).put("size_bytes", bytes.size).put("purpose", purpose),
        ) as JSONObject
        val headers = start.optJSONObject("headers")?.let { h -> h.keys().asSequence().associateWith { h.getString(it) } } ?: emptyMap()
        api.putBinary(start.getString("upload_url"), bytes, headers, start.optString("method", "PUT"))
        val id = start.getString("id")
        api.send("POST", "/files/$id/complete", JSONObject())
        return id
    }

    override suspend fun attachmentUrl(attachmentId: String): String =
        (api.send("GET", "/messaging/files/$attachmentId/url") as JSONObject).getString("url")
}
