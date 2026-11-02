import uuid
from datetime import date

from pydantic import BaseModel


# ------------------------------------------------------------------ students
class CountRow(BaseModel):
    key: str
    count: int


class ClassCount(BaseModel):
    class_id: uuid.UUID
    class_label: str
    students: int
    capacity: int


class StudentsAnalytics(BaseModel):
    scope: str  # school | my_classes
    year: str | None
    active: int
    by_class: list[ClassCount]
    by_gender: list[CountRow]
    by_category: list[CountRow]
    left_this_year: int
    passed_out: int


# ------------------------------------------------------------------ fees (admin and fees.manage only)
class ClassDues(BaseModel):
    class_id: uuid.UUID | None
    class_label: str
    students: int
    dues_paise: int


class FeesAnalytics(BaseModel):
    year: str | None
    billed_paise: int  # fee lines of this year's invoices, net of concessions, incl. late fees
    collected_paise: int  # payments (not cancelled) on this year's invoices
    collected_this_month_paise: int
    dues_paise: int  # balance of open invoices, any year
    overdue_paise: int
    dues_students: int
    collection_percentage: float | None  # collected / (billed + dues carried in), capped at 100
    top_dues_classes: list[ClassDues]


# ------------------------------------------------------------------ results
class SubjectResult(BaseModel):
    subject_id: uuid.UUID
    subject: str
    students: int  # marks entered
    average_percentage: float | None
    pass_rate: float | None


class ClassResult(BaseModel):
    class_id: uuid.UUID
    class_label: str
    students: int  # with every paper entered
    average_percentage: float | None
    pass_rate: float | None
    published: bool


class ResultsAnalytics(BaseModel):
    exam_id: uuid.UUID | None
    exam: str | None
    scope: str
    students: int
    average_percentage: float | None
    pass_rate: float | None
    by_subject: list[SubjectResult]
    by_class: list[ClassResult]
    grade_spread: list[CountRow]


class TeacherClassResult(BaseModel):
    class_id: uuid.UUID
    class_label: str
    subject_id: uuid.UUID | None  # null = as class teacher (all subjects)
    subject: str | None
    students: int
    average_percentage: float | None
    pass_rate: float | None


class TeacherResult(BaseModel):
    staff_id: uuid.UUID
    name: str
    average_percentage: float | None  # students-weighted over the subjects they teach
    classes: list[TeacherClassResult]


class TeacherResults(BaseModel):
    exam_id: uuid.UUID | None
    exam: str | None
    teachers: list[TeacherResult]


# ------------------------------------------------------------------ staff attendance
class StaffAttendanceAnalytics(BaseModel):
    from_on: date
    to_on: date
    active_staff: int
    marked_today: int
    present_today: int
    absent_today: int
    leave_today: int
    days_marked: int
    days_present: int
    days_absent: int
    days_leave: int
    present_percentage: float | None


# ------------------------------------------------------------------ dashboard
class DashboardAttendance(BaseModel):
    today_percentage: float | None
    month_percentage: float | None
    classes_total: int
    classes_marked_today: int


class DashboardFees(BaseModel):
    collected_this_month_paise: int
    dues_paise: int
    overdue_paise: int
    dues_students: int


class DashboardResults(BaseModel):
    exam: str | None
    average_percentage: float | None


class DashboardStaff(BaseModel):
    active_staff: int
    present_today: int
    absent_today: int
    not_marked_today: int


class DashboardRollover(BaseModel):
    show_banner: bool
    days_left: int | None
    current_year: str | None


class Dashboard(BaseModel):
    scope: str  # school | my_classes
    year: str | None
    students: int
    classes: int
    attendance: DashboardAttendance
    fees: DashboardFees | None  # admin and fees.manage
    results: DashboardResults
    staff: DashboardStaff | None  # admin and staff.manage
    rollover: DashboardRollover | None  # admin and academic.manage


# ------------------------------------------------------------------ teacher-wise (one view) and subject-wise
class TeacherAssignmentOut(BaseModel):
    class_id: uuid.UUID
    class_label: str
    role: str  # class_teacher | subject_teacher
    subject_id: uuid.UUID | None
    subject: str | None
    attendance_percentage: float | None  # of this class in the period


class TeacherSubjectOut(BaseModel):
    class_id: uuid.UUID
    class_label: str
    subject_id: uuid.UUID | None  # null = as class teacher (all subjects of the class)
    subject: str | None
    students: int
    average_percentage: float | None
    pass_rate: float | None
    previous_average_percentage: float | None  # the same figure in the previous exam of the year
    improvement: float | None  # average minus previous average, in percentage points
    published: bool


class TeacherFeedbackOut(BaseModel):
    request_id: uuid.UUID
    title: str
    average_rating: float | None
    responses: int


class TeacherStaffAttendance(BaseModel):
    days_marked: int
    days_present: int
    days_absent: int
    days_leave: int
    percentage: float | None


class TeacherWiseRow(BaseModel):
    staff_id: uuid.UUID
    name: str
    designation: str
    assignments: list[TeacherAssignmentOut]
    class_attendance_percentage: float | None  # classes they are class teacher of
    taught_attendance_percentage: float | None  # every class they teach
    results: list[TeacherSubjectOut]
    average_percentage: float | None  # students-weighted over `results`
    pass_rate: float | None
    previous_average_percentage: float | None
    improvement: float | None
    staff_attendance: TeacherStaffAttendance
    feedback: TeacherFeedbackOut | None  # null until a request that includes them has closed and is shared


class TeacherWise(BaseModel):
    year_id: uuid.UUID | None
    year: str | None
    from_on: date
    to_on: date
    exam_id: uuid.UUID | None
    exam: str | None
    previous_exam: str | None
    scope: str  # school | me
    teachers: list[TeacherWiseRow]


class ClassFigure(BaseModel):
    class_id: uuid.UUID
    class_label: str
    students: int
    average_percentage: float | None
    pass_rate: float | None


class SubjectWiseRow(BaseModel):
    subject_id: uuid.UUID
    subject: str
    students: int  # marks entered
    average_percentage: float | None
    pass_rate: float | None
    best_class: ClassFigure | None  # only when the subject is taught in two or more classes
    weakest_class: ClassFigure | None
    classes: list[ClassFigure]


class SubjectWise(BaseModel):
    year_id: uuid.UUID | None
    exam_id: uuid.UUID | None
    exam: str | None
    scope: str  # school | my_classes
    subjects: list[SubjectWiseRow]
