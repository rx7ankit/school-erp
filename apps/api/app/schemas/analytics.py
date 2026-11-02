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
