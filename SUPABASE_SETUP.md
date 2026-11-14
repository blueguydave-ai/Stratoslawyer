# Supabase setup — STRATOSLAWYER

This guide prepares the database and authentication project for the multi-user dashboard.

## 1. Create a Supabase project

1. Sign in at https://supabase.com/dashboard.
2. Create a new project for STRATOSLAWYER.
3. Choose a strong database password and keep it in your password manager.
4. Choose a region appropriate for your users and your data-protection requirements. Confirm the provider's current data-processing and residency terms before storing client-confidential material.

## 2. Create the database schema

1. Open the new project.
2. Open **SQL Editor**.
3. Open this repository file: `supabase/migrations/001_initial_multi_user_schema.sql`.
4. Copy the entire SQL file into a new SQL query and run it.
5. Confirm the query completes successfully.

The migration creates profiles, subscriptions, monthly usage, usage transactions, cases, document metadata, AI request records and payments. It enables row-level security and intentionally prevents browser clients from writing billing or usage records.

## 3. Configure authentication

In Supabase, open **Authentication → URL Configuration**.

- Set the Site URL to the deployed STRATOSLAWYER domain.
- Add the deployed domain and local development URL to the Redirect URLs list.
- For initial testing, email/password sign-in can be enabled under **Authentication → Providers**.
- Configure email confirmation and SMTP before inviting real users. Do not assume the default test email service is suitable for production.

## 4. Retrieve the browser-safe project settings

Open **Project Settings → API** (or the API Keys page in the current dashboard) and copy:

- Project URL
- Publishable key (or legacy anon public key)

These two values are designed for browser use when Row Level Security is correctly configured.

**Never put the service_role key, secret API key, database password, Paystack secret key or Gemini API key in frontend code, public repository files, screenshots or chat messages.** The service-role key bypasses RLS and must remain server-side.

## 5. Send the two browser-safe values for the next implementation step

Once the SQL migration has run, provide the Project URL and publishable/anon key. They are public client configuration values, not secret credentials. The next code change will add registration, login, session handling and a protected lawyer workspace.

## Important current limitations

- The migration is a foundation, not a finished billing implementation.
- No payment webhook, usage-debit function, monthly reset job, private storage bucket or dashboard has been activated yet.
- Do not upload real client documents until authentication, private storage policies, server-side usage accounting, retention controls and provider confidentiality settings have been implemented and tested.
- Admin role assignment must be performed by a trusted project owner through a controlled server-side process; never expose role editing to ordinary users.
