"""Seed the synthetic org mailbox: Riverbank Community Fridge.

Five Monday-morning messages: two routine (auto-answer), one judgment call
(the agent must pause on), one scheduling request, one spam. Run:
    .venv/bin/python agent/seed.py
"""

import smtplib
from email.message import EmailMessage

MSGS = [
    ("volunteer.maya@example.org", "Volunteering this weekend?",
     "Hi! I'd like to volunteer this Saturday morning. What time do shifts start and do I need to bring anything? Thanks, Maya"),
    ("elder.housing@example.org", "Do you deliver to Elder Housing?",
     "Hello, we serve 40 residents at the Elder Housing complex. Do you deliver surplus food to us on weekdays? We have cold storage. Regards, Sam (activity coordinator)"),
    ("donor.john@example.org", "Change of pickup date?",
     "Hi, John here. I usually drop off bread Tuesdays but I'm travelling this week. Can we move my pickup donation to Thursday next week instead?"),
    ("events@example.org", "Booking the community hall",
     "Could we book the hall next Friday 6-9pm for a neighbourhood meeting? Roughly 30 people, we'd need chairs. Who confirms this?"),
    ("no-reply@definitelyspam.biz", "YOU HAVE WON!!!",
     "Congratulations!!! Click to claim your prize now!!! Limited time!!!"),
]

with smtplib.SMTP("localhost", 1025) as s:
    for frm, subj, body in MSGS:
        m = EmailMessage()
        m["From"] = frm
        m["To"] = "desk@foodbank.local"
        m["Subject"] = subj
        m.set_content(body)
        s.send_message(m)
        print("seeded:", subj)
print("done")
