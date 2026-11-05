# Locking the database to "edit" logins

By default the Firebase rules are `auth != null` — any signed-in browser can write. With the steps below the **database itself**
only accepts writes from people who logged in with an **edit** passcode. "View" logins can read but never write, even if someone
tampers with the page.

The code is already deployed and works **with or without** the key, so you can do this at your own pace. Do the steps in order.

## 1. Create a service-account key (Firebase Console)
1. Firebase Console → your project → ⚙ **Project settings** → **Service accounts** tab.
2. Click **Generate new private key** → confirm. A `.json` file downloads.
3. Treat it like a password: never email it, post it in chat, or commit it to GitHub.

## 2. Put it in Railway
1. Railway → your service → **Variables** → **New Variable**.
2. Name: `FIREBASE_SERVICE_ACCOUNT`
3. Value: open the downloaded `.json` in Notepad, select everything, copy, paste as the value.
   *(If Railway refuses the multi-line paste, convert the file to one line first — in PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json"))` — and paste that text instead. Both forms work.)*
4. Save → Railway redeploys. Check the deploy logs: there must be **no** line saying `FIREBASE_SERVICE_ACCOUNT is set but unreadable`.
5. Log in to the app and make a small edit — it should still save. (Everyone now signs in with a token carrying their edit/view mode.)
6. You can now delete the downloaded `.json` file from your computer.

## 3. Publish the strict rules
Firebase Console → **Realtime Database** → **Rules** → replace everything with the text below → **Publish**.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "shifts":      { ".read": "auth.token.mode != null", ".write": "auth.token.mode == 'edit'" },
    "settings":    { ".read": "auth.token.mode != null", ".write": "auth.token.mode == 'edit'" },
    "activityLog": { ".read": "auth.token.mode != null", ".write": "auth.token.mode == 'edit'" },
    "snapshots":   { ".read": "auth.token.mode != null", ".write": "auth.token.mode == 'edit'" },
    "presence":    { ".read": "auth.token.mode != null", ".write": "auth.token.mode != null" }
  }
}
```

## 4. Check it worked
- Log in with an **edit** passcode → edit something → refresh → the change is still there.
- Log in with a **view** passcode → you can see everything, nothing can be changed, and the "online" chip still works.
- The sheet watcher (Railway logs) keeps running without `watcher error` lines.
- Anyone still on an old page opened before step 3 must refresh / log in again.

## Undo
Paste the previous rules back (`{"rules": {".read": "auth != null", ".write": "auth != null"}}`) and Publish.

## Optional
Once everything works you can switch off **Authentication → Sign-in method → Anonymous**; the app no longer needs it.
