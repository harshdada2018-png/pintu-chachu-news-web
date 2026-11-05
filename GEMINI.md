# Project & Communication Rules (GEMINI.md)

## Communication Preference
- **Language**: Always talk to the user in **Hinglish** (Hindi written in Roman/English alphabet, e.g., "Bhai ye issue tha aur isko solve kar diya hai...") combined with English.
- **No Heavy Devanagari Hindi**: Do not output formal, Sanskritized, or pure Devanagari Hindi in conversational responses. Keep explanations easy, natural, and friendly.
- **Technical Precision**: Keep code, file paths, variables, CSS classes, and architecture terms in clear English.

## Execution Rules
- Follow **Rule 9: One Task at a Time** — Complete, Verify & Get Approval before moving to the next task.
- Follow **Rule 10: Master Checklist Testing Verification** — In `project-planning/CHECKLIST.md`, every completed task must record its concrete verified testing outcome and build proof.
- Follow **Rule 1: Learning & Mistake Prevention** — Record root causes and solutions in `learning/mistakes.md`.
- Follow **Rule 7: Project Planning** — Keep `project-planning/PROGRESS.md` and `DECISIONS.md` up to date.
- Follow **Rule 4: Premium UI/UX** — Ensure 100% responsiveness on mobile viewports (iPhone, Android) as well as desktop laptops.
- **Mandatory User Testing Guide in Every Task Report**:
  - In the completion report of EVERY task, provide clear testing guidance for the user:
    - **Manual Frontend/UI Testing**: If the feature can be tested via UI/browser, give simple numbered step-by-step instructions so the user can cross-check live.
    - **Backend / Command-Only Verification**: If the feature is backend-only, background cron, database purge, or API-only and cannot be tested manually via UI, explicitly tell the user: *"Is feature ki manual frontend se testing nahi ho sakti."* Then provide the exact command run and the concrete verified result/output obtained.
