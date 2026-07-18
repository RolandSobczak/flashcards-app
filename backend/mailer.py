import smtplib
from email.message import EmailMessage

from .config import settings


def send_login_code_email(to_email: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = f"Twój kod logowania: {code}"
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(
        f"Twój kod logowania do Fiszek: {code}\n\n"
        f"Kod jest ważny przez {settings.login_code_ttl_minutes} minut. "
        "Jeśli to nie Ty próbowałeś się zalogować, zignoruj tę wiadomość."
    )
    message.add_alternative(
        f"""\
<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
  <h2 style="color: #1a1a28;">Fiszki — kod logowania</h2>
  <p>Twój kod logowania:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px;">{code}</p>
  <p style="color: #666;">Kod jest ważny przez {settings.login_code_ttl_minutes} minut.</p>
  <p style="color: #999; font-size: 13px;">Jeśli to nie Ty próbowałeś się zalogować, zignoruj tę wiadomość.</p>
</div>
""",
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
