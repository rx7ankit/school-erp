"""Wording of the notifications parents receive, in English and Hindi.

The product is English only except the parent experience (English + Hindi). A hook picks a template key and gives
the variables once:

    m = render("attendance_absent", name="Aarav", cls="8-A", day=date(2026, 12, 10))
    await notify_guardians_of_student(db, student_id, kind="attendance_absent", **m.kw(), data=...)

`notify` stores the text already rendered per recipient (users.language), so the inbox row and the push are in the
language the parent chose. Variables that are `date`s are written per language ("10 Dec" / "10 दिसंबर"); money is
passed as `rupees(paise)` text (the same in both). Children's first names stay as written. Staff-directed
notifications do not use this module.
"""

from dataclasses import dataclass
from datetime import date

from app.services.notify_helpers import short_date

HI_MONTHS = (
    "जनवरी",
    "फ़रवरी",
    "मार्च",
    "अप्रैल",
    "मई",
    "जून",
    "जुलाई",
    "अगस्त",
    "सितंबर",
    "अक्टूबर",
    "नवंबर",
    "दिसंबर",
)


def short_date_hi(d: date) -> str:
    """date(2026, 12, 10) -> '10 दिसंबर'"""
    return f"{d.day} {HI_MONTHS[d.month - 1]}"


@dataclass(frozen=True)
class Msg:
    title: str
    body: str
    title_hi: str | None = None
    body_hi: str | None = None

    def kw(self) -> dict[str, str | None]:
        """Keyword arguments for notify() / notify_guardians_of_student()."""
        return {"title": self.title, "body": self.body, "title_hi": self.title_hi, "body_hi": self.body_hi}


# key -> (English title, English body, Hindi title, Hindi body)
T: dict[str, tuple[str, str, str, str]] = {
    "attendance_present": (
        "{name} is present today",
        "{name} is present today ({cls}, {day}).",
        "{name} आज उपस्थित है",
        "{name} आज उपस्थित है ({cls}, {day})।",
    ),
    "attendance_absent": (
        "{name} is absent today",
        "{name} is absent today ({cls}, {day}).",
        "{name} आज अनुपस्थित है",
        "{name} आज अनुपस्थित है ({cls}, {day})।",
    ),
    "attendance_first_half": (
        "{name} attended the first half only",
        "{name} attended the first half only ({cls}, {day}).",
        "{name} आज केवल पहले हाफ़ में आया",
        "{name} आज केवल पहले हाफ़ में उपस्थित रहा ({cls}, {day})।",
    ),
    "attendance_second_half": (
        "{name} attended the second half only",
        "{name} attended the second half only ({cls}, {day}).",
        "{name} आज केवल दूसरे हाफ़ में आया",
        "{name} आज केवल दूसरे हाफ़ में उपस्थित रहा ({cls}, {day})।",
    ),
    "leave_approved": (
        "Leave approved",
        "Leave for {name} ({span}) was approved.",
        "छुट्टी स्वीकृत",
        "{name} की छुट्टी ({span}) स्वीकृत हो गई है।",
    ),
    "leave_rejected": (
        "Leave not approved",
        "Leave for {name} ({span}) was not approved.",
        "छुट्टी स्वीकृत नहीं हुई",
        "{name} की छुट्टी ({span}) स्वीकृत नहीं हुई।",
    ),
    "fee_invoice": (
        "New fee invoice",
        "{name}: fee invoice {period} of {amount} is due by {due}.",
        "नई फ़ीस रसीद",
        "{name}: {period} की फ़ीस {amount} है, {due} तक जमा करें।",
    ),
    "fee_payment": (
        "Payment received",
        "{amount} received for {name}, receipt {receipt}.",
        "भुगतान मिल गया",
        "{name} के लिए {amount} प्राप्त हुए, रसीद {receipt}।",
    ),
    "fee_reminder": (
        "Fee reminder",
        "Fee reminder: {amount} is due for {name}{by}",
        "फ़ीस की याद दिलाना",
        "फ़ीस की याद दिलाना: {name} की {amount} फ़ीस बकाया है{by}।",
    ),
    "result": (
        "Results are out",
        "Results of {exam} are out for {name}.",
        "परिणाम आ गया है",
        "{name} का {exam} का परिणाम आ गया है।",
    ),
    "exam": (
        "Date sheet published",
        "Date sheet for {sheet} is out for {name}.",
        "परीक्षा की डेटशीट आ गई है",
        "{name} के लिए {sheet} की डेटशीट आ गई है।",
    ),
    "feedback": (
        "Rate your child's teachers",
        "Please rate {name}'s teachers: {title}, until {until}.",
        "शिक्षकों को रेटिंग दें",
        "कृपया {name} के शिक्षकों को रेटिंग दें: {title}, {until} तक।",
    ),
    "certificate_issued": (
        "Certificate ready",
        "{kind} {number} for {name} is ready.",
        "प्रमाणपत्र तैयार है",
        "{name} का {kind_hi} {number} तैयार है।",
    ),
    "library_due": (
        "Library book overdue",
        "{name}: '{title}' was due on {due}. Please return it to the library.",
        "लाइब्रेरी की किताब लौटाने की याद",
        "{name}: '{title}' {due} को लौटानी थी। कृपया इसे लाइब्रेरी में जमा करें।",
    ),
    "promotion_promoted": (
        "Congratulations!",
        "Congratulations! {name} is now in Class {dest} for {year}.",
        "बधाई हो!",
        "बधाई हो! {name} अब {year} में कक्षा {dest} में है।",
    ),
    "promotion_stayed": (
        "New academic year",
        "{name} will continue in Class {dest} for {year}.",
        "नया शैक्षणिक सत्र",
        "{name} {year} में भी कक्षा {dest} में ही रहेगा।",
    ),
    "promotion_completed": (
        "Congratulations!",
        "Congratulations! {name} has completed Class {old}.",
        "बधाई हो!",
        "बधाई हो! {name} ने कक्षा {old} पूरी कर ली है।",
    ),
    "message": (
        "Message from {sender}",
        "{text}",
        "{sender} का संदेश",
        "{text}",
    ),
}

CERT_HI = {
    "Transfer certificate": "स्थानांतरण प्रमाणपत्र",
    "Bonafide certificate": "बोनाफ़ाइड प्रमाणपत्र",
    "Character certificate": "चरित्र प्रमाणपत्र",
}


def _one(x, lang: str):
    if isinstance(x, date):
        return short_date_hi(x) if lang == "hi" else short_date(x)
    if isinstance(x, tuple):  # (English text, Hindi text) of a variable that is worded differently per language
        return x[1] if lang == "hi" else x[0]
    return x


def _fill(template: str, lang: str, v: dict) -> str:
    return template.format(**{k: _one(x, lang) for k, x in v.items()})


def render(key: str, **v) -> Msg:
    """English and Hindi text of template `key`. Extra variables are ignored."""
    en_t, en_b, hi_t, hi_b = T[key]
    if "kind" in v and v["kind"] in CERT_HI:
        v = {**v, "kind_hi": CERT_HI[v["kind"]]}
    return Msg(_fill(en_t, "en", v), _fill(en_b, "en", v), _fill(hi_t, "hi", v), _fill(hi_b, "hi", v))


def span(a: date, b: date) -> tuple[str, str]:
    """(English, Hindi) wording of a date range: '3 Dec to 5 Dec' / '3 दिसंबर से 5 दिसंबर'."""
    if a == b:
        return short_date(a), short_date_hi(a)
    return f"{short_date(a)} to {short_date(b)}", f"{short_date_hi(a)} से {short_date_hi(b)}"
