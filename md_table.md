| ID | Input | Expected | Actual Status | Triggered Gate | Message |
|---|---|---|---|---|---|
| 1 | Book dentist next Friday at 3pm | ok | **ok** | **N/A** | OK: 2026-08-21 15:00 - Dentistry |
| 2 | I need an appointment with cardiology on October 15th at 10:30 AM | ok | **ok** | **N/A** | OK: 2026-10-15 10:30 - Cardiology |
| 3 | Schedule a physiotherapy session for tomorrow at 9am | ok | **ok** | **N/A** | OK: 2026-08-13 09:00 - Physiotherapy |
| 4 | ENT checkup this Monday at 11:00 | ok | **ok** | **N/A** | OK: 2026-08-17 11:00 - ENT |
| 5 | Book dentist appointment | needs_clarification | **needs_clarification** | **G3** | Missing both date and time — please specify when you'd like the appointment |
| 6 | Need to see a doctor next Friday | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 7 | Book something at 3pm | needs_clarification | **needs_clarification** | **G9** | Department not recognized - please specify a valid department |
| 8 | cardiology appointment | needs_clarification | **needs_clarification** | **G3** | Missing both date and time — please specify when you'd like the appointment |
| 9 | next Friday at 3pm | needs_clarification | **needs_clarification** | **G9** | Department not recognized - please specify a valid department |
| 10 | Book dentist Friday | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 11 | Book dentist next week | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 12 | Book dentist soon | needs_clarification | **needs_clarification** | **G7** | Could not understand the requested date/time |
| 13 | Book dentist ASAP | needs_clarification | **needs_clarification** | **G7** | Could not understand the requested date/time |
| 14 | Book dentist sometime next month | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 15 | Book dentist next Friday at 3 | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 16 | Book dentist next Friday at 9 | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 17 | Book dentist next Friday at 25:00 | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 18 | Book dentist next Friday evening | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 19 | Book dentist next Friday sometime in the afternoon | needs_clarification | **needs_clarification** | **G5** | Multiple possible dates/times mentioned — please clarify which one you mean |
| 20 | Book dentist next Friday, actually make it Saturday, at 3pm | ok | **ok** | **N/A** | OK: 2026-08-15 15:00 - Dentistry |
| 21 | Book dentist at 3pm, no wait 5pm | ok | **ok** | **N/A** | OK: 2026-08-13 17:00 - Dentistry |
| 22 | Book dentist for Monday at 3pm or maybe Tuesday at 4pm, not sure yet | needs_clarification | **needs_clarification** | **G5** | Multiple possible dates/times mentioned — please clarify which one you mean |
| 23 | Book dentist next Friday at 3pm and cardiology next Monday at 10am | needs_clarification | **needs_clarification** | **G3** | Missing both date and time — please specify when you'd like the appointment |
| 24 | I need to see both the dentist and an ENT sometime next week | needs_clarification | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 25 | Book physiotherapy session next Friday at 3pm | ok | **ok** | **N/A** | OK: 2026-08-21 15:00 - Physiotherapy |
| 26 | i need sum physiotherpy on 12/12 at 14:00 | ok | **ok** | **N/A** | OK: 2026-12-12 14:00 - Physiotherapy |
| 27 | Book podiatry next Friday at 3pm | needs_clarification | **needs_clarification** | **G9** | Department not recognized - please specify a valid department |
| 28 | Book with Dr. Kumar next Friday at 3pm | needs_clarification | **needs_clarification** | **G9** | Department not recognized - please specify a valid department |
| 29 | Book an appointment next Friday at 3pm | needs_clarification | **needs_clarification** | **G9** | Department not recognized - please specify a valid department |
| 30 | bk dentist nxt fri @ 3pm pls | ok | **ok** | **N/A** | OK: 2026-08-14 15:00 - Dentistry |
| 31 | BOOK DENTIST NEXT FRIDAY AT 3 PM | ok | **ok** | **N/A** | OK: 2026-08-21 15:00 - Dentistry |
| 32 | pls book dental 4 tomorw at 5 | needs_clarification | **needs_clarification** | **G7** | Could not understand the requested date/time |
| 33 | Hi, hope you're doing well! I wanted to reach out because I need to book dentist next Friday at 3pm. Thanks so much, John | ok | **ok** | **N/A** | OK: 2026-08-21 15:00 - Dentistry |
| 34 | yo can u book me in w the dentist next friday around 3ish pm thx | ok | **needs_clarification** | **Completeness Check** | Missing a clear time for the appointment — please specify when |
| 35 | Book dentist on 03/04 at 2pm | ok | **ok** | **N/A** | OK: 2027-03-04 14:00 - Dentistry |
| 36 | Book dentist on 2026-09-05 at 15:00 | ok | **ok** | **N/A** | OK: 2026-09-05 15:00 - Dentistry |
| 37 | Schedule an appointment for 4pm today | needs_clarification | **needs_clarification** | **G6** | That date appears to be in the past — please confirm or provide a future date |
| 38 | Book dentist last Friday at 3pm | needs_clarification | **needs_clarification** | **G6** | That date appears to be in the past — please confirm or provide a future date |
| 39 |  | needs_clarification | **needs_clarification** | **G1** | Could not read any text from the input |
| 40 |     | needs_clarification | **needs_clarification** | **G1** | Could not read any text from the input |
| 41 | asdkjqwoieuqwoiue lorem ipsum dolor sit amet | needs_clarification | **needs_clarification** | **G3** | Missing both date and time — please specify when you'd like the appointment |
| 42 | What's the weather like tomorrow? | needs_clarification | **needs_clarification** | **G4** | Ambiguous date/time or department |
| 43 | Cancel my dentist appointment next Friday at 3pm | needs_clarification | **ok** | **N/A** | OK: 2026-08-21 15:00 - Dentistry |
| 44 | Reschedule my dentist appointment from next Friday 3pm to the following Monday 10am | needs_clarification | **ok** | **N/A** | OK: 2026-08-17 10:00 - Dentistry |
| 45 | Book dentist next Friday at 3pm'; DROP TABLE appointments;-- | needs_clarification | **ok** | **N/A** | OK: 2026-08-21 15:00 - Dentistry |
