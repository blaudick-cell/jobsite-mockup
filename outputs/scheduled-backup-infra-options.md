# Scheduled backup infra — pick one

2026-05-24. The browser-side backup system shipped in commit `<TODO-backup-commit>` covers on-demand Excel + SQL export from `/admin/backup`. Daily 2am auto-backup needs server-side infra because a static React app can't run on a schedule when the tab is closed.

Three viable paths. Pick one based on the trade-offs below — none of them live in `index.html`, so this is a separate ticket once Robert decides.

---

## Option A — Netlify Scheduled Function

A serverless function on Netlify runs on a cron schedule, fetches all 12 Supabase tables via the publishable key (or a service-role key stored as a Netlify env var), and ships the file out.

**Where the backup ends up:** depends on what you wire up:
- Email attachment (SMTP via SendGrid / Postmark / Resend) → lands in Robert's inbox
- AWS S3 / Backblaze B2 / Cloudflare R2 → lands in object storage with versioning
- GitHub repo (force-push to a backup branch) → free version history, but exposes data to anyone with repo read

**Cost:** Netlify free tier includes 125,000 function invocations + scheduled functions on the Pro plan ($19/mo). Storage destination cost on top — S3 standard is ~$0.023/GB/mo, R2 has no egress fee.

**Complexity:** Medium. Write the function (~150 lines Node), add a `netlify.toml` schedule entry, set env vars for Supabase service role key + destination credentials. Test the cron in staging by triggering manually before relying on the schedule.

**What fails silently:** if Supabase rotates the service role key and you forget to update the Netlify env var, the function 401s forever with no surfacing. Mitigation: add a `console.error` + a heartbeat Slack webhook that fires on every successful run, so silence is the alarm. Also: Netlify scheduled functions can be skipped if the deploy is idle — verify in the Netlify functions log dashboard weekly.

**Recoverable if the app is gone:** yes — backups live entirely off-Netlify-app once shipped to S3/email/repo. A new fresh Supabase project can be hydrated from the .sql dump alone.

**Best for:** if Robert already runs Netlify Pro and has S3 / Resend creds handy, this is the lowest-friction path.

---

## Option B — Supabase Edge Function on pg_cron

A Postgres `pg_cron` job triggers a Supabase Edge Function (Deno) that dumps the database to a storage bucket inside the same Supabase project.

**Where the backup ends up:** a `backups/` bucket inside the same Supabase project. Optionally also pushed to S3 via a second hop.

**Cost:** Free tier covers it — pg_cron is included on every Supabase project, Edge Functions are 500k invocations/mo on the free tier. Storage bucket usage counts against the Supabase 1GB free quota; rotation needs to drop old backups to stay under.

**Complexity:** Medium-high. Need to enable `pg_cron` extension, write the Edge Function in TypeScript/Deno, configure the cron schedule via a SQL statement, and write the rotation logic (delete blobs older than 30 days). Test path is awkward — Edge Functions are hard to iterate on locally.

**What fails silently:** if the Supabase project gets paused (free tier auto-pauses after 7 days of no activity), pg_cron stops with no notification. Mitigation: a webhook from the Edge Function to an external heartbeat service (cron-job.org / dead-man's-snitch / your own monitoring). Also: a backup that lives ONLY inside the same Supabase project does not protect against a "Supabase deleted my project" failure mode — for that you need an off-Supabase copy.

**Recoverable if the app is gone:** yes for app-loss, NO for Supabase-account-loss (backups live in the same project). For true DR add Option A's off-Supabase egress as a secondary hop.

**Best for:** if Robert wants zero new infra services + zero new costs and is OK with the "same-project" caveat. Pairs well with Supabase PITR for additional safety.

---

## Option C — OS-level cron on Robert's machine + CLI script

A Node or Python script runs on Robert's Windows machine via Task Scheduler (or WSL cron). It hits the same Supabase REST endpoints with a service role key and writes the .xlsx + .sql files to `C:\Users\blaud\Documents\JSE-backups\` with the 30-daily + 12-monthly rotation Robert originally asked for.

**Where the backup ends up:** local Windows filesystem. Optionally synced to OneDrive/Dropbox/Google Drive for off-machine durability.

**Cost:** $0. Zero new services.

**Complexity:** Low to write (~100 lines Node + a Task Scheduler entry). Medium to keep running — depends on Robert's machine being on at 2am, not locked in a way that prevents Task Scheduler from running, not paused for an OS update, etc. If Robert's machine is off the night the schedule fires, no backup until next run.

**What fails silently:** machine off, machine asleep, machine rebooted mid-script, Task Scheduler disabled by Windows Update, service role key rotated. Mitigation: log each run to a date-stamped log file and have a separate weekly task that emails Robert if the most recent log is older than 25 hours.

**Recoverable if the app is gone:** yes — backups are entirely off-Netlify and off-Supabase. Worst-case is Robert's machine + its OneDrive sync both being gone, which is also the case where most office workflows are also lost.

**Best for:** if Robert wants the absolute minimum surface area (no third party at all) and is the only person who needs access to the backups. Closest match to the "save to `C:\Users\blaud\Documents\JSE-backups\` with rotation" wording in the original brief.

---

## Quick comparison

| | A: Netlify Scheduled Fn | B: Supabase Edge Fn / pg_cron | C: OS cron on Robert's machine |
|---|---|---|---|
| Setup time | ~2 hours | ~3 hours | ~1 hour |
| Monthly cost | $0–$19 (Netlify Pro) + storage | $0 (within free tier) | $0 |
| Off-Supabase copy? | ✅ if S3/email destination | ❌ unless second hop added | ✅ |
| Survives Supabase outage? | ✅ | ❌ | ✅ |
| Survives Netlify outage? | ❌ | ✅ | ✅ |
| Requires Robert's machine on? | ❌ | ❌ | ✅ |
| Heartbeat / "backup failed" alerting needed? | Yes — silence is the alarm | Yes — silence is the alarm | Yes — silence is the alarm |
| Restore tested by humans every quarter? | Should be | Should be | Should be |

---

## Recommendation

Pick **A** if there's already a Netlify Pro account + an S3 bucket / SMTP creds Robert can drop env vars for. The off-Supabase copy is the only path that survives both Netlify-outage AND Supabase-outage scenarios when paired with the on-demand backups already shipped to `/admin/backup`.

Pick **C** if Robert wants zero third-party additions and the "machine on at 2am" assumption holds.

Pick **B** only if cost is the dominating constraint — and pair it with the on-demand `/admin/backup` SQL download as the manual off-Supabase escape hatch.

Whatever you pick: add a heartbeat ping to an external monitor (cron-job.org has a free tier) so a silent failure surfaces within 25 hours.
