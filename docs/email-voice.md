# How Nalu emails sound

Nalu emails should read like they come from a well-run, trustworthy local company: professional and natural, warm but never cute. Say what the email is for, give the reader one clear thing to do, and stop. Code: `src/lib/email/layout.ts`. Sign-in emails: `supabase/email-templates/build.py`.

## Tone
- **Write like a real person at a good company.** Use "we" and "you", and contractions are fine. Write full, clear sentences, the way you'd explain something to a customer at the counter.
- **Useful first.** Lead with what Nalu does or what changed. Skip warm-up lines about the reader's inbox, mood or morning.
- **No gimmicks.** No slogans, puns, jokes, cute metaphors ("taps you on the shoulder") or lines that try to be relatable ("half-awake", "at the cones"). If a line is there to sound charming rather than to inform, cut it.
- **Plain English for every age.** Short sentences, everyday words. No "leverage", "optimize", "seamless", "journey". It should read the same to a retiree reading every word and a night-shift worker skimming on a phone.
- **Don't assume the reader's schedule.** Many riders work nights or weekends. Avoid "before Monday", "tomorrow morning" and similar unless it's true for everyone.
- **Calm, not alarming.** Roadwork and event days are heads-ups, not warnings. No ALL CAPS, no "URGENT".

## Hawaiian words
- Don't use *aloha* or *mahalo* as marketing filler. Locals notice, and it reads like a tourist brochure. In practice our emails don't need them at all; use one only where a local business would naturally say it to a customer face to face.
- Always write **Oʻahu** with the ʻokina (ʻ, not an apostrophe). Keep kahakō in place names (Waikīkī, Kaimukī, Mānoa).
- No pidgin, no "brah", no tiki, hula or lei clichés, no surf talk.

## Length and shape
- Welcome email: about 100 to 140 words. Other marketing emails: as short as the content allows.
- Sign-in emails: a plain headline that says what to do ("Sign in to Nalu", "Reset your password") and one line.
- One headline, one short intro, a list only when there are real steps or items, one button.
- Sign off from **The Nalu team** with a simple line ("Thanks for using Nalu,", "Have a good week,", "Take care,"). A P.S. is fine when it adds a true, useful fact, like the core answer staying free.
- Body text 16px or larger. Every email needs a plain-text version that reads well by itself.

## Subject lines and preheaders
- Specific and calm, under about 50 characters where possible. Say what's inside: "This week on your route: 2 planned closures".
- Clear beats clever. No exclamation marks, no greetings, no clickbait, no fake "Re:", no all caps, no emoji.
- Always write a preheader. It adds a fact the subject doesn't have; it never repeats it.

## Never
- Never invent numbers, minutes saved, stats, rider counts, quotes or testimonials.
- Never promise features Nalu doesn't have, or say Nalu "predicts" or "guarantees" anything.
- Never guess a rider's name (we don't have it, and we never pull one from an email address). No `{name}`, no "Dear rider".
- Never knock Google Maps or Apple Maps. Nalu decides; they navigate.
- Never state event facts (closures, times) we haven't been given from an official source. Link to the official page instead.
- Never guilt or nag people about turning things on, and never hide the unsubscribe link.

## Lines we cut and why (October 2026 audit)
A reader panel (a Kapolei H-1 driver, a retired Kaimukī bus rider, a Waikīkī night-shift worker, a UH Mānoa grad student, a military spouse new to ʻEwa Beach, and a born-and-raised local) read every email. These lines went:

| Cut | Why |
| --- | --- |
| "Mahalo for letting us into your inbox." | The owner and the local reader both found it silly; "mahalo" as filler reads as tourist marketing. |
| "Aloha! 3 small steps to make Nalu yours" (subject) and "Aloha, glad you're here" (heading) | Greeting-as-subject says nothing about the email; the exclamation mark felt salesy. Now "Welcome to Nalu: 3 quick setup steps". |
| "Three quick things make it feel like it knows you" | Vague and a little creepy to the skeptical commuter. |
| "No typing addresses half-awake." | Night-shift and retired readers didn't relate; the joke assumes a morning commute. |
| "Nalu taps you on the shoulder when it's time to go" | Cute metaphor; the retired reader wondered what it meant. Now "Nalu will let you know when it's time to go." |
| "No account needed, no catch." | "No catch" sounds like a sales pitch and raises suspicion. The free, no-account fact stays, stated plainly. |
| "Better to know now than at the cones." | Trying too hard; the plain list of closures already makes the point. |
| "Good news before Monday", "Nice when that happens", "Enjoy it." | Filler; "before Monday" assumes a weekday schedule. |
| "Your week ahead: 2 heads-ups for your route" (subject) | "Heads-ups" is vague; the subject now names what it is: planned closures. |
| "Bring your patience ... A little aloha on the road goes a long way." | Preachy, and aloha used as a slogan. Replaced with a practical step about people walking near the event. |
| "Enjoy the day, wherever it takes you," | Greeting-card sign-off. Now "Take care,". |
| "Here's your way in", "Aloha, welcome to Nalu", "Let's get you back in", "It happens to everyone." (sign-in emails) | Sign-in emails should say exactly what to do. Headlines now state the action. |
