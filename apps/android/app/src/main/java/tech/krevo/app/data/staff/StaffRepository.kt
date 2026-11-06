package tech.krevo.app.data.staff

/** Everything the staff screens need from a backend. Screens never talk to anything else. */
interface StaffRepository {
    suspend fun me(): StaffMe
    /** What this person's app shows (tabs, menu, Home blocks), decided by the server. */
    suspend fun homeLayout(): HomeLayout
    /** Uploads a JPEG as this person's photo; null removes it. */
    suspend fun setPhoto(jpeg: ByteArray?)
    suspend fun dashboard(): StaffDashboard
    suspend fun classes(): List<StaffClass>
    /** Every class this person can see on one date, with its attendance percentage. */
    suspend fun dayOverview(day: String): DayOverview
    suspend fun assignments(classId: String): List<AssignmentRow>
    suspend fun subjects(): List<Subject>

    suspend fun attendanceSheet(classId: String, day: String): AttendanceSheet
    suspend fun saveAttendance(classId: String, day: String, students: List<SheetStudent>): AttendanceSheet

    suspend fun students(query: String, classId: String?, offset: Int): Page<StudentItem>
    suspend fun student(id: String): StudentDetail

    /** [status] is "pending", "approved", "rejected" or null for all. */
    suspend fun leaves(status: String?): List<StaffLeave>
    suspend fun decideLeave(id: String, approve: Boolean, note: String): StaffLeave

    suspend fun myDay(on: String): List<DayEntry>

    /** The latest notices, newest first. */
    suspend fun broadcasts(): List<Broadcast>
    /** One page of notices, newest first, starting at [offset]. */
    suspend fun broadcastPage(offset: Int): Page<Broadcast>
    /** [classId] null means the whole school; [attachmentIds] are photos already uploaded with [uploadAttachment]. */
    suspend fun postBroadcast(title: String, body: String, classId: String?, attachmentIds: List<String>): Broadcast

    /** Edits a notice. [attachmentIds] is the complete list of photos it should have afterwards (up to five). */
    suspend fun editBroadcast(id: String, title: String, body: String, attachmentIds: List<String>): Broadcast
    suspend fun deleteBroadcast(id: String)

    /** Conversations with parents (only teachers have them). Newest first. */
    suspend fun threads(): List<StaffThread>
    /** Oldest first. Opening a thread marks it read. */
    suspend fun threadMessages(threadId: String): List<StaffMessage>
    /** Starts (or reopens) my conversation about a child and returns its id. [subjectId] null = as class teacher. */
    suspend fun openThread(studentId: String, subjectId: String?): String
    suspend fun sendMessage(threadId: String, text: String, attachmentIds: List<String>): StaffMessage
    /** Uploads a photo or video for a chat message or a notice and returns its id. */
    suspend fun uploadAttachment(bytes: ByteArray, filename: String, contentType: String): String
    suspend fun attachmentUrl(attachmentId: String): String

    suspend fun staff(query: String): List<StaffMember>
    suspend fun accessOptions(): AccessOptions
    suspend fun setPermissions(staffId: String, permissions: List<String>): StaffMember
    suspend fun addStaff(name: String, email: String, designation: String, permissions: List<String>, sendLogin: Boolean): StaffMember
    suspend fun sendLogin(staffId: String)

    suspend fun feesSummary(): FeesSummary
    suspend fun dues(query: String): List<DueRow>
}
