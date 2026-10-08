# MCQ question bank and exams

## What is included

The student exam flow is available at `#/mcq-exam` as **Exam Name**. Students can filter the published bank by class, group, subject, part and chapter, choose a question count and duration, and then take an exam with saved answers, navigation, review flags, a server-controlled timer and submission. The result includes answer review and practice from mistakes. Student history, XP, badges, accuracy and streaks appear on the dashboard/profile.

The **প্রশ্ন ব্যাংক** menu is available to administrators. It shows source-file reconciliation, duplicate counts and review items. Only questions that pass structural checks are published by the importer. Conflicting answer keys and malformed candidates stay in review; exam clients never receive the correct key before submission.

The MCQ data is stored in the PostgreSQL tables declared in `prisma/schema.prisma`, separately from the legacy teacher-authored exam feature. `McqImportItem` makes each source-file/candidate pair idempotent, source SHA-256 identifies source files, and questions retain class/subject/part/chapter plus source page/location. Attempt questions are immutable snapshots so later edits to a bank question do not change an existing result.

## Prepare the importer on Windows

Run from the repository root. DOCX and PDF extraction need the Python packages below. Bijoy/Sutonny font conversion also needs Node.js dependencies from `npm ci`; the importer uses the font-aware, MIT-licensed `bijoy2unicode` package. Binary `.doc` conversion uses LibreOffice/antiword when available, or Microsoft Word COM. The Word COM path opens documents read-only and disables macros.

```powershell
python -m pip install -r tools/requirements-mcq-import.txt
npm ci
```

Scanned PDFs need the Tesseract executable plus the `ben` and `eng` language data installed on the machine. `pytesseract` is only the Python wrapper; it does not install Tesseract. If OCR is unavailable or returns low confidence, the source page is reported for review and its page image is retained when possible.

## Pilot, audit and import

Start with a small offline pilot. This writes reports beside the source folder by default; choose another output path if desired.

```powershell
python tools/mcq_importer.py "C:\Users\user\Downloads\Exam\Class 3" --max-files 20 --output-dir "C:\Users\user\Downloads\Exam-mcq-pilot"
```

Inspect `summary.json`, `audit.csv`, `audit.jsonl` and the per-file JSON under `files/`. `audit.csv` uses UTF-8 with BOM for spreadsheet compatibility. Confirm folder metadata, Bengali Unicode, option order, the marked answer and question counts against the originals. `Class 3/3. Class 3 Math/3. MCQ/chapter-1.docx` and its PDF counterpart are useful regression samples: both currently yield the same 20 questions and answer keys after legacy-font conversion.

`detected`, `local_valid_candidates` and `needs_review` count MCQ candidates, not parser warning rows. Multiple warnings for one candidate are one review candidate; warnings without a candidate index (for example, an unreadable scanned page) are counted separately as `source_issue_count`. The candidate partition is reported as `candidate_reconciliation_ok`. A failed source file makes that flag false because its unknown question count cannot be reconciled. Offline audits do not claim questions were imported or that cross-file duplicates were resolved; those totals are only final after a database upload and server reconciliation.

If a long audit is interrupted, resume it without reprocessing completed files:

```powershell
python tools/mcq_importer.py "C:\Users\user\Downloads\Exam" --output-dir "C:\Users\user\Downloads\Exam-MCQ-Audit" --workers 8 --resume
```

After all source files finish, refresh folder-derived labels and produce final candidate reconciliation, media quota accounting, a Class/Subject taxonomy CSV, and a human-reviewable potential duplicate/conflicting-answer report:

```powershell
python tools/mcq_audit_finalize.py "C:\Users\user\Downloads\Exam" "C:\Users\user\Downloads\Exam-MCQ-Audit"
```

The finalizer does not alter question text or answers and never removes potential duplicates. `potential-duplicates.jsonl` is only a review report; definitive duplicate counts require the database import reconciliation.

The parser is intentionally conservative, but an automatically parsed question is not the same as a human-verified answer. Review every `REVIEW_REQUIRED` file and unresolved item. A file with no detected question is not silently treated as fully imported: the file-level audit records it for review. Rerunning the same unchanged source is safe; candidate identities are based on the source hash and candidate index.

After configuring a persistent PostgreSQL database and an admin account, upload the audited collection:

```powershell
$env:SHIKHOK_ADMIN_EMAIL = "admin@example.com"
$env:SHIKHOK_ADMIN_PASSWORD = "your-admin-password"
python tools/mcq_importer.py "C:\Users\user\Downloads\Exam" --api-url "https://shikhok.onrender.com" --batch-size 20
```

Do not put the password in the command line or a checked-in file. The API requires an authenticated `ADMIN` or `SUPER_ADMIN` session. Import batches are retryable; the server finalizes a file only after candidate outcomes reconcile to imported, duplicate, rejected and review counts.

## Database and Render configuration

Set `DATABASE_URL` on the web service to the database's pooled PostgreSQL connection string. On startup, `server/start.mjs` runs `prisma migrate deploy` before starting the application. A missing database leaves the existing app available, but every MCQ bank route returns `503` until PostgreSQL is connected.

Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` as private Render environment variables to create/promote the first admin; the password must be at least 16 characters. `BOOTSTRAP_ADMIN_NAME` is optional. The bootstrap runs on each server startup and resets that account's password to the configured secret, so keep the secret stable and private. Production exposes only the student demo login; teacher, parent and admin demo credentials remain blocked.

MCQ sources, candidates, issues, questions, attempts, answers and bookmarks are stored in separate indexed PostgreSQL tables. Class, group, subject, part and chapter are indexed scope labels on those rows; they are not yet a separate curriculum dictionary. The remaining legacy app data still uses the demo JSON store, and login sessions are held in process memory; the current Render web service is free and has ephemeral local storage. A broader public launch still needs durable storage for the remaining app data and a database plan with enough capacity and backups. Source-page images are stored in private S3-compatible object storage; PostgreSQL keeps each media object's key, MIME type and source trace.

For a zero-cost pilot, use Neon Free for PostgreSQL and its S3-compatible Object Storage while the web service stays on Render Free. Neon currently lists 1 GB of database storage, 5 GB of object storage and 100 CU-hours per project per month. Question rows and attempt history count toward the database quota; source/page images use the separate object-storage quota. Create a **private** Neon bucket named `mcq-media`, then set these private Render environment variables:

```text
DATABASE_URL                 Neon pooled PostgreSQL URL
AWS_ENDPOINT_URL_S3          Neon branch's S3 endpoint
AWS_REGION                   Neon branch region (for example us-east-2)
AWS_ACCESS_KEY_ID            Neon storage credential
AWS_SECRET_ACCESS_KEY        Neon storage secret
MCQ_MEDIA_BUCKET             mcq-media
```

The importer refuses image-bearing uploads in production when object storage is missing, rather than filling the small Postgres quota with page binaries. Local development can still keep media in Postgres. Measure the completed source audit before relying on the free storage quotas. Render's own free PostgreSQL database expires, so it is unsuitable for long-lived student history. These free plans are suitable for a pilot; a broad public launch needs a capacity plan, backups, and durable storage for the rest of the app.

Student account credentials are mirrored into PostgreSQL at registration/login and before the first MCQ attempt so a student can sign in again after the free web service restarts. MCQ attempts and profile statistics stay in PostgreSQL. The wider app still uses its demo JSON store, and its login sessions remain in process memory; a restart may require signing in again and does not make the rest of the app's demo data durable.

## Local verification

```powershell
npm run typecheck
npm test
npm run build
npm run lint
python -m py_compile tools/mcq_importer.py
python tools/test_mcq_importer.py
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/shikhok?schema=public"
npx prisma validate
```

The real-database exam flow also needs a running PostgreSQL instance with the migration applied; `prisma validate` only checks the schema and does not replace an integration test.
