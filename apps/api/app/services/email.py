"""Email. Login emails carry a temporary password, so they are sent directly and never stored."""

import asyncio
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("scool.email")


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


_sender: EmailSender | None = None


def get_sender() -> EmailSender:
    global _sender
    if _sender is None:
        _sender = {"memory": MemoryEmailSender, "smtp": SmtpEmailSender}.get(
            settings.email_backend, ConsoleEmailSender
        )()
    return _sender


def set_sender(s: EmailSender | None) -> None:
    global _sender
    _sender = s


def login_mail(*, name: str, email: str, password: str, school: str) -> Mail:
    return Mail(
        to=email,
        subject=f"Your Scool login for {school}",
        body=(
            f"Hello {name},\n\n"
            f"{school} has created a Scool login for you.\n\n"
            f"Email: {email}\nTemporary password: {password}\n\n"
            "You will be asked to choose your own password the first time you sign in.\n\n"
            f"Web: {settings.app_base_url}\niPhone: {settings.ios_app_url}\nAndroid: {settings.android_app_url}\n\n"
            "If you were not expecting this, please ignore this email."
        ),
    )


def reset_mail(*, name: str, email: str, token: str) -> Mail:
    return Mail(
        to=email,
        subject="Reset your Scool password",
        body=(
            f"Hello {name},\n\n"
            f"Use this link to choose a new password. It works for {settings.reset_ttl_minutes} minutes.\n\n"
            f"{settings.app_base_url}/reset-password?token={token}\n\n"
            "If you did not ask for this, "
            "you can ignore this email."
        ),
    )
