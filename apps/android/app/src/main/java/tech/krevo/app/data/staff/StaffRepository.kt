package tech.krevo.app.data.staff

/** Everything the staff screens need from a backend. Screens never talk to anything else. */
interface StaffRepository {
    suspend fun me(): StaffMe
    suspend fun dashboard(): StaffDashboard
    suspend fun classes(): List<StaffClass>

    suspend fun attendanceSheet(classId: String, day: String): AttendanceSheet
    suspend fun saveAttendance(classId: String, day: String, students: List<SheetStudent>): AttendanceSheet
    /** Daily attendance percentage for the last [days] days, scoped to what this person may see. */
    suspend fun attendanceInsight(days: Int): AttendanceInsight

    suspend fun students(query: String, classId: String?, offset: Int): Page<StudentItem>
    suspend fun student(id: String): StudentDetail

    /** [status] is "pending", "approved", "rejected" or null for all. */
    suspend fun leaves(status: String?): List<StaffLeave>
    suspend fun decideLeave(id: String, approve: Boolean, note: String): StaffLeave

    suspend fun myDay(on: String): List<DayEntry>

    suspend fun broadcasts(): List<Broadcast>
    /** [classId] null means the whole school. */
    suspend fun postBroadcast(title: String, body: String, classId: String?): Broadcast

    /** Conversations with parents (only teachers have them). Newest first. */
    suspend fun threads(): List<StaffThread>
    /** Oldest first. Opening a thread marks it read. */
    suspend fun threadMessages(threadId: String): List<StaffMessage>
    suspend fun sendMessage(threadId: String, text: String, attachmentIds: List<String>): StaffMessage
    /** Uploads a photo or video for a chat message and returns its id. */
    suspend fun uploadAttachment(bytes: ByteArray, filename: String, contentType: String): String
    suspend fun attachmentUrl(attachmentId: String): String

    suspend fun staff(query: String): List<StaffMember>
    suspend fun feesSummary(): FeesSummary
    suspend fun dues(query: String): List<DueRow>
}
