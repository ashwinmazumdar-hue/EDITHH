# EDITH v3 | Campaign Intelligence

## What changed from v2
- Data is stored as individual rows in Supabase, not one giant blob. A single month's
  file was 19 MB as a blob, which is over Vercel's 4.5 MB limit, so saves were silently
  rejected. Now each file is grouped down (April 2025: 77,072 rows become 1,322, totals
  identical) and saved in batches of 500 straight to Supabase.
- Loading reads every row in pages of 1,000 (Supabase's per-request cap).
- Re-uploading a file replaces its old data instead of doubling numbers.
- Each file can be removed on its own from the Import tab.
- No email codes needed to sign up.
- Fixed: April's AppsFlyer sheet spells the column "Platorm", so its sessions never
  joined before. Fixed: "Campaign Name" was reading the "Platform Campaign Name" column.
- EDITH AI now receives platform totals and platform-by-month numbers, so questions like
  "what was Jio Star's CPS in April" can actually be answered.

## Setup
1. Supabase > SQL Editor > New query > paste supabase_setup.sql > Run
2. Supabase > Authentication > Sign In / Providers > Email > turn OFF "Confirm email" > Save
3. GitHub: replace the repo contents with the files in this folder.
   package.json must be visible on the repo's front page, not inside a subfolder.
4. Vercel > Settings > Environment Variables must have:
   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY
   (optional: OPENAI_API_KEY, GEMINI_API_KEY)
5. Vercel > Settings > General > Root Directory must be empty. Redeploy.
6. Sign up on the site, then in Supabase SQL Editor run:
   update public.profiles set role = 'admin' where email = 'YOUR_EMAIL';
   Log out and back in.
7. Re-upload your XLSX files from the Import tab (the old table is replaced).
