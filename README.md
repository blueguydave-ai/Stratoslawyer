# STRATOSLAWYER

A universal Nigerian legal case-intelligence and preparation tool for lawyers handling matters across Nigerian courts, tribunals and dispute-resolution environments — not only civil litigation.

## Product principle

**Simple on the surface; rigorous underneath.** A lawyer should be able to describe a matter in ordinary language, attach the documents already available, and let the system infer the case type, legal environment and next analytical steps. It should ask only questions that materially affect the analysis.

## First working slice

- Responsive dark-and-muted-gold interface.
- Free-form case description and multi-document intake.
- Matter-aware analysis for civil, criminal, constitutional, commercial, land, family, labour, election, tax, IP, regulatory, ADR, appellate and other matters.
- Two-sided case stress-test, evidence mapping, blind-spot and contradiction review, qualitative outcome ranking and lawful tactical preparation.
- Gemini API called only from a server-side Vercel function; API key is never sent to the browser.
- PDF, TXT, Markdown, JPG, PNG and WebP uploads (up to 6 files; 2 MB each; 2.7 MB combined in this first version).

## Run locally

1. Install the Vercel CLI.
2. Add `GEMINI_API_KEY` to your local Vercel environment or `.env.local`.
3. Run `vercel dev`.

## Deploy

Import this repository into Vercel and add:

- `GEMINI_API_KEY` — required server-side secret.
- `GEMINI_MODEL` — optional; defaults to `gemini-2.5-flash`.

Redeploy after setting environment variables.

## Accounts and sign-in

- Browser authentication uses Supabase Auth with persistent sessions, automatic token refresh and local sign-out. A user normally remains signed in on the same browser/device after closing and reopening the site.
- New accounts use email and password. For immediate access without a verification email, open the Supabase project and go to **Authentication → Sign In / Providers → Email**. Turn off **Confirm email** and save. Also make sure **Allow new users to sign up** is enabled. The site cannot change these project-level settings from browser code. Supabase then treats the submitted email as confirmed without proving that the user owns it; users can mistype an address or register an address they do not control.
- Password reset remains available by email. Add `https://stratoslawyer.vercel.app/**` under **Authentication → URL Configuration → Redirect URLs** so the recovery link can return to the production site. Supabase email delivery limits still apply to password recovery messages.
- The analysis endpoint verifies the signed-in user's access token with Supabase before processing a request. Do not replace the publishable key with a service-role key in browser code.
- A session is specific to that browser profile/device. Signing out, clearing site data, using private browsing, or browser storage restrictions can require signing in again. Signing out on one device does not intentionally sign out other devices.

## Important limitations

- This is an initial working foundation, not a complete legal research platform.
- The upload limit is deliberately small because serverless request bodies have size constraints. A later document pipeline should upload files directly to private object storage or the provider's file API, then process them asynchronously.
- Uploaded source materials are sent to the configured Gemini API for analysis. Do not upload client-confidential or privileged material until access controls, provider data handling, retention, encryption and professional confidentiality requirements have been assessed and approved.
- There is no user authentication, matter-level access control, persistent case storage, audit trail or abuse/rate protection yet. Do not expose this prototype as a public service for confidential client matters.
- DOCX, XLSX, scanned-document OCR, page-level source citations and live Nigerian legal research are not implemented yet.
- It does not independently verify current statutes, rules, citations or deadlines. Check all authorities against authoritative current sources before reliance.
- Qualitative outcome rankings are analytical estimates, not statistically calibrated predictions.
- All output must be reviewed by a qualified Nigerian legal practitioner.

## Planned architecture

1. Universal intake and matter classification.
2. Secure document extraction, OCR, page-level references and evidence indexing.
3. Jurisdiction-, court-, subject- and procedure-aware Nigerian law packs.
4. Chronology, issue and element-to-evidence mapping.
5. Witness, exhibit and contradiction analysis.
6. Opposing-counsel / hostile-case simulation.
7. Distinct outcome scenarios with explicit assumptions and uncertainty.
8. Lawful tactical options linked to evidence and procedural posture.
9. Verified legal research with traceable source passages and update dates.
10. Matter readiness tracking and incremental re-analysis as new documents arrive.

The legal environment must be selected dynamically. A criminal prosecution, election petition, NICN matter, fundamental-rights application, appeal and arbitration should not be forced into the same procedural workflow.
