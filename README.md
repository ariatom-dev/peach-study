# Peach Study — cloud sync setup

Peach Study remains free to use and does not use AI. This version adds optional Supabase email/password sign-in and cloud-synced study decks.

## Important separation
Use a **new Supabase project just for Peach Study**. Do not use your Intellectual Peach project's credentials or database.

## 1. Create a Supabase project
1. Go to https://supabase.com/dashboard and create a new project named `Peach Study`.
2. Choose the free plan if available for your account.
3. In Project Settings / API Keys, copy the Project URL and the **publishable key** (`sb_publishable_...`). Do not use a secret or service-role key in the app.
4. In the new project's SQL Editor, open `supabase/peach_study_schema.sql`, paste the full contents, and run it.
5. In Authentication settings, keep email/password enabled. For the simplest testing experience, you may keep email confirmation on; then confirm the link sent to your email before signing in.
6. In Authentication URL configuration, set the Site URL to `https://peach-study.vercel.app`. Add `http://localhost:5173/**` and `https://peach-study.vercel.app/**` to the Redirect URLs allow list.

## 2. Configure locally
1. Copy `.env.example` to `.env.local`.
2. Fill in:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key
3. In PowerShell, from the project folder run:
   ```powershell
   npm install
   npm run dev
   ```
4. Create an account or sign in and test creating a deck.

## 3. Configure Vercel
In Vercel, open the Peach Study project → Settings → Environment Variables. Add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Add both to Production and Preview (and Development if desired), then redeploy.

## 4. Publish code changes
Use GitHub Desktop to copy the updated files into your cloned `peach-study` repository. Commit and Push. Vercel will rebuild automatically.

## Existing local decks
After signing in, decks already stored in the current browser are copied to your account if the cloud copy doesn't already contain the same deck ID. Export a JSON backup first as a precaution. Cloud decks belong to the signed-in account.

## Security
- The SQL enables row-level security and restricts each user to their own rows.
- The browser app must only use the publishable key.
- Never add `.env.local` to GitHub. The `.gitignore` excludes `.env` files.
- Keep your exported JSON backups somewhere private.
