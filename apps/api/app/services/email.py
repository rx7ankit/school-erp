"""Email. Login emails carry a temporary password, so they are sent directly and never stored."""

import asyncio
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

import httpx

from app.core.config import settings

log = logging.getLogger("slov.email")


@dataclass
class Mail:
    to: str
    subject: str
    body: str


class EmailSender:
    async def send(self, mail: Mail) -> None:
        raise NotImplementedError


class ConsoleEmailSender(EmailSender):
    async def send(self, mail: Mail) -> None:
        log.info("EMAIL to=%s subject=%s\n%s", mail.to, mail.subject, mail.body)


class MemoryEmailSender(EmailSender):
    """For tests: keeps what was sent."""

    def __init__(self) -> None:
        self.sent: list[Mail] = []
        self.fail = False

    async def send(self, mail: Mail) -> None:
        if self.fail:
            raise RuntimeError("mail server unreachable")
        self.sent.append(mail)

    def last_to(self, to: str) -> Mail | None:
        return next((m for m in reversed(self.sent) if m.to.lower() == to.lower()), None)


class SmtpEmailSender(EmailSender):
    async def send(self, mail: Mail) -> None:
        def _send() -> None:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = settings.email_from, mail.to, mail.subject
            msg.set_content(mail.body)
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
                s.starttls()
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)

        await asyncio.to_thread(_send)


class ResendEmailSender(EmailSender):
    """Sends through Resend's HTTP API. No SDK needed."""

    URL = "https://api.resend.com/emails"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    async def send(self, mail: Mail) -> None:
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is not set")
        async with httpx.AsyncClient(transport=self._transport, timeout=15) as c:
            r = await c.post(
                self.URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [mail.to], "subject": mail.subject, "text": mail.body},
            )
        if r.status_code >= 300:
            # Never log the body of the mail: it carries a temporary password.
            raise RuntimeError(f"Resend rejected the email ({r.status_code}): {r.text[:200]}")


_sender: EmailSender | None = None


def get_sender() -> EmailSender:
    global _sender
    if _sender is None:
        _sender = {"memory": MemoryEmailSender, "smtp": SmtpEmailSender, "resend": ResendEmailSender}.get(
            settings.email_backend, ConsoleEmailSender
        )()
    return _sender


def set_sender(s: EmailSender | None) -> None:
    global _sender
    _sender = s


def login_mail(*, name: str, email: str, password: str, school: str, parent: bool = False) -> Mail:
    return Mail(
        to=email,
        subject=f"Your Slov login for {school}",
        body=(
            f"Hello {name},\n\n"
            f"{school} has created a Slov login for you.\n\n"
            f"Email: {email}\nTemporary password: {password}\n\n"
            "You will be asked to choose your own password the first time you sign in.\n\n"
            f"Web: {settings.app_base_url}\niPhone: {settings.ios_app_url}\nAndroid: {settings.android_app_url}\n\n"
            "If you were not expecting this, please ignore this email."
            + (
                f"\n\n---\n\nनमस्ते {name},\n\n"
                f"{school} ने आपके लिए Slov लॉगिन बनाया है। ऊपर दिए गए ईमेल और अस्थायी पासवर्ड (Temporary password) "
                "से साइन इन करें। पहली बार साइन इन करने पर आपको अपना नया पासवर्ड चुनना होगा। "
                "ऐप में आप हिंदी भाषा चुन सकते हैं।\n\n"
                "अगर आपको यह ईमेल अपेक्षित नहीं था, तो कृपया इसे अनदेखा करें।"
                if parent
                else ""
            )
        ),
    )


def reset_mail(*, name: str, email: str, token: str, parent: bool = False) -> Mail:
    return Mail(
        to=email,
        subject="Reset your Slov password",
        body=(
            f"Hello {name},\n\n"
            f"Use this link to choose a new password. It works for {settings.reset_ttl_minutes} minutes.\n\n"
            f"{settings.app_base_url}/reset-password?token={token}\n\n"
            "If you did not ask for this, "
            "you can ignore this email."
            + (
                f"\n\n---\n\nनमस्ते {name},\n\n"
                "नया पासवर्ड चुनने के लिए ऊपर दिए गए लिंक का उपयोग करें। "
                f"यह लिंक {settings.reset_ttl_minutes} मिनट तक चलेगा।\n\n"
                "अगर आपने यह अनुरोध नहीं किया था, तो इस ईमेल को अनदेखा करें।"
                if parent
                else ""
            )
        ),
    )
