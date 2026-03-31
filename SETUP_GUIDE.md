# FilmDeck — Deployment Guide
## How to get FilmDeck live on filmdeck.pages.dev

This guide has **5 steps**. Each one is simple — no coding required.
Estimated time: **20–30 minutes** (mostly waiting for Cloudflare to load).

---

## Before you start

You need:
- A computer (Windows or Mac)
- Google Chrome or Firefox
- The `filmdeck.zip` file I gave you

---

## STEP 1 — Create a free Cloudflare account

1. Open your browser and go to: **https://dash.cloudflare.com/sign-up**
2. Enter your email address and create a password
3. Check your email and click the verification link Cloudflare sends you
4. You're in. You should see the Cloudflare dashboard.

---

## STEP 2 — Install the Cloudflare tool on your computer

This is a small tool that lets your computer talk to Cloudflare.
You only do this once ever.

### On Windows:
1. Press the **Windows key**, type `cmd`, press **Enter**
   (A black window opens — this is the terminal)
2. Copy and paste this line into it, then press **Enter**:
   ```
   winget install Cloudflare.wrangler
   ```
3. Wait for it to finish. It will say "Successfully installed" when done.
4. Close and reopen the terminal window.

### On Mac:
1. Press **Cmd + Space**, type `Terminal`, press **Enter**
2. Copy and paste this line, then press **Enter**:
   ```
   brew install cloudflare/cloudflare/wrangler
   ```
   If it says "brew not found", first run:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Then try the wrangler line again.
3. Wait for it to finish.

### Verify it worked:
Type this and press Enter:
```
wrangler --version
```
You should see a version number like `3.x.x`. Good.

---

## STEP 3 — Set up the database

FilmDeck needs a database to store your projects and users.

### 3a. Log in to Cloudflare from your terminal

In your terminal, run:
```
wrangler login
```
A browser window will open asking you to authorise. Click **Allow**. 
Come back to the terminal — it should say "Successfully logged in".

### 3b. Create the database

Run this command:
```
wrangler d1 create filmdeck-db
```

Cloudflare will respond with something like:
```
✅ Successfully created DB 'filmdeck-db'

[[d1_databases]]
binding = "DB"
database_name = "filmdeck-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**IMPORTANT:** Copy that `database_id` value. You need it in the next step.

### 3c. Update wrangler.toml with your database ID

1. Open the `filmdeck` folder from the zip file
2. Open `wrangler.toml` in any text editor (Notepad on Windows, TextEdit on Mac)
3. Find the line that says:
   ```
   database_id = "PLACEHOLDER_REPLACE_AFTER_STEP_3"
   ```
4. Replace `PLACEHOLDER_REPLACE_AFTER_STEP_3` with the ID you copied
5. Save the file

### 3d. Create the database tables

In your terminal, navigate to the filmdeck folder:

**Windows:**
```
cd C:\Users\YourName\Downloads\filmdeck
```
(Replace `YourName` with your actual Windows username, and adjust the path if you unzipped it somewhere else)

**Mac:**
```
cd ~/Downloads/filmdeck
```

Then run:
```
wrangler d1 execute filmdeck-db --file=schema.sql --remote
```
You should see it run several SQL statements. This creates all the tables.

---

## STEP 4 — Set your passwords

This step creates your 5 user accounts securely.

1. Open the `filmdeck` folder
2. Double-click `seed-passwords.html` — it opens in your browser
3. Enter a password for each of the 5 users:
   - **Shiv** (Admin — this is you)
   - Adhi
   - Cheralathan
   - Sameer
   - Sudarshan
4. Click **Generate Setup SQL**
5. Click **Copy SQL**

Now go back to your terminal and run:
```
wrangler d1 execute filmdeck-db --remote --command "DELETE FROM users;"
```

Then run:
```
wrangler d1 execute filmdeck-db --remote --command "PASTE_YOUR_SQL_HERE"
```
Replace `PASTE_YOUR_SQL_HERE` by pasting the SQL you copied from the browser.
(On Windows: right-click to paste. On Mac: Cmd+V)

---

## STEP 5 — Deploy FilmDeck

This uploads your app to Cloudflare and makes it live.

In your terminal (make sure you're still in the `filmdeck` folder), run:
```
wrangler pages deploy . --project-name filmdeck
```

Cloudflare will ask you a few questions:
- **"What would you like to use as your project name?"** → type `filmdeck` and press Enter
- **"What branch are you deploying to?"** → press Enter (accepts `main`)

It will upload all your files. When it finishes you'll see:

```
✅ Deployment complete!

Take a peek over at https://filmdeck.pages.dev
```

**That's it. FilmDeck is live.**

---

## Testing your deployment

1. Open **https://filmdeck.pages.dev** in your browser
2. You should see the FilmDeck login page
3. Log in with your username (Shiv) and the password you set in Step 4
4. You should land on the main app

If something doesn't work, see Troubleshooting below.

---

## Sharing with your team

Send each person:
- The URL: **https://filmdeck.pages.dev**
- Their username (Adhi / Cheralathan / Sameer / Sudarshan)
- Their password (tell them in person or via WhatsApp — not email)

They can change their own password after logging in via **⚙ Settings**.

---

## How to update FilmDeck in the future

Whenever I give you a new version of the app files, just run this in your terminal from the filmdeck folder:
```
wrangler pages deploy . --project-name filmdeck
```
That's all — Cloudflare replaces the old version in about 30 seconds. Your data is never touched.

---

## Troubleshooting

**Login page shows but login fails**
→ The SQL in Step 4 may not have run correctly. Open `seed-passwords.html` again, generate the SQL again, and re-run Step 4.

**Page shows "Error" or blank screen**
→ Make sure `wrangler.toml` has the correct `database_id` from Step 3b.

**"wrangler: command not found"**
→ Close and reopen your terminal after Step 2, then try again.

**"filmdeck.pages.dev" is already taken**
→ In Step 5, when asked for a project name, try `filmdeck-app` or `myfilmdeck` instead. Your URL will then be `filmdeck-app.pages.dev`.

**Forgot a user's password**
→ Log in as Shiv, go to ⚙ Settings → User Management, click Reset PW next to their name.

---

## Important notes

- **Your data is stored in Cloudflare's database** — not in your browser. It works on any device.
- **Cloudflare free tier** covers up to 100,000 database reads per day — more than enough for 5 users.
- **No credit card needed** — everything in this guide is free.
- **Backups** — use the ↓ Backup button in FilmDeck to download a JSON copy of any project locally.

---

*FilmDeck · Phase 1 · Built for Shiv*
