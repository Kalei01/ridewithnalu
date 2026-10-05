"""Builds Nalu's sign-in email templates (Supabase Auth -> Resend).

Run: python3 supabase/email-templates/build.py
Writes one .html per email next to this file, plus subjects.json.
Apply them in Supabase (Authentication -> Emails -> Templates) or via the
Management API (PATCH /v1/projects/<ref>/config/auth).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent
LOGO = "https://ridenalu.com/icons/icon-192.png"

# key: (subject, heading, body, button, url variable)
EMAILS = {
    "magic_link": (
        "Your Nalu sign-in link",
        "Sign in to Nalu",
        "Tap the button below to sign in. The link works once and expires in an hour.",
        "Sign in",
        "{{ .ConfirmationURL }}",
    ),
    "confirmation": (
        "Confirm your email for Nalu",
        "Confirm your email",
        "Tap the button below to confirm your email address and finish setting up your account.",
        "Confirm email",
        "{{ .ConfirmationURL }}",
    ),
    "recovery": (
        "Reset your Nalu password",
        "Reset your password",
        "Tap the button below to choose a new password. The link works once.",
        "Reset password",
        "{{ .ConfirmationURL }}",
    ),
    "email_change": (
        "Confirm your new email for Nalu",
        "Confirm your new email",
        "Tap the button below to start using {{ .NewEmail }} for your Nalu account.",
        "Confirm new email",
        "{{ .ConfirmationURL }}",
    ),
    "invite": (
        "You're invited to Nalu",
        "You're invited to Nalu",
        "Nalu tells you whether to drive, take the bus or ride Skyline across Oʻahu, and when to leave. Tap the button below to accept.",
        "Accept invite",
        "{{ .ConfirmationURL }}",
    ),
}

PAGE = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{subject}</title></head>
<body style="margin:0;padding:0;background:#eef2f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#08090b;">
<tr><td align="center" style="padding:36px 32px 8px;">
<img src="{logo}" width="64" height="64" alt="Nalu" style="display:block;border:0;border-radius:14px;">
</td></tr>
<tr><td align="center" style="padding:16px 32px 0;">
<h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;">{heading}</h1>
</td></tr>
<tr><td align="center" style="padding:12px 32px 0;">
<p style="margin:0;font-size:17px;line-height:1.5;color:#3a434c;">{body}</p>
</td></tr>
<tr><td align="center" style="padding:28px 32px 8px;">
<a href="{url}" style="display:inline-block;background:#287fc0;color:#ffffff;text-decoration:none;font-size:18px;font-weight:600;padding:16px 36px;border-radius:12px;">{button}</a>
</td></tr>
<tr><td align="center" style="padding:20px 32px 32px;">
<p style="margin:0;font-size:14px;line-height:1.5;color:#59636d;">If you didn't ask for this email, you can safely ignore it.</p>
</td></tr>
</table>
<p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#59636d;">Nalu &middot; Your Oʻahu commute, decided &middot; <a href="https://ridenalu.com" style="color:#287fc0;">ridenalu.com</a></p>
</td></tr>
</table>
</body>
</html>
"""

subjects = {}
for key, (subject, heading, body, button, url) in EMAILS.items():
    html = PAGE.format(subject=subject, heading=heading, body=body, button=button, url=url, logo=LOGO)
    (HERE / f"{key}.html").write_text(html)
    subjects[key] = subject
(HERE / "subjects.json").write_text(json.dumps(subjects, indent=2, ensure_ascii=False) + "\n")
print("built", ", ".join(EMAILS))
