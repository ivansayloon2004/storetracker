# Supabase Setup

1. Create a Supabase project.
2. Open the SQL Editor and run `supabase-setup.sql`.
3. In Supabase Auth, enable email and password sign-in.
4. For the easiest test flow, turn off email confirmation while you are setting the app up.
5. Confirm `supabase-config.js` has your Supabase project URL and public anon key.
6. If you switch to a different Supabase project later, replace those values with the new project details.
7. Push the updated files to GitHub so Render redeploys the site.

Example:

```js
window.TINDAHAN_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

Administrator setup:

1. Create the account through the app or directly in Supabase Auth.
2. Run this SQL in Supabase:

```sql
update public.profiles
set role = 'admin'
where email = 'your-admin-email@example.com';
```

After that:

- the same store account can sign in on phone and desktop
- barcode scans on the phone update the shared inventory
- the admin panel can read the shared workspace instead of one browser only
