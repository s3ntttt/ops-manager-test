# OPS MANAGER — How to Run

## Requirements
- Node.js 18 or newer — download from https://nodejs.org

---

## First-time setup (do this once)

Open a terminal / Command Prompt in this folder and run:

```
npm install
```

This downloads Express and the other packages listed in package.json.

---

## Starting the server

```
npm start
```

Then open your browser and go to:

```
http://localhost:3000
```

The team accesses the app on the same WiFi via your PC's IP address, e.g.:

```
http://192.168.1.10:3000
```

To find your IP: run `ipconfig` in Command Prompt and look for "IPv4 Address".

---

## During development (auto-restarts on file changes)

```
npm run dev
```

---

## Configuration (.env file)

All secrets live in the `.env` file — never share this file:

| Variable | What it is |
|---|---|
| `ACCESS_CODE` | The team access code shown on the login screen |
| `JWT_SECRET` | Random string used to sign sessions — change this! |
| `GOOGLE_SHEETS_API_KEY` | Your Google Cloud API key |
| `FIREBASE_*` | Your Firebase project config |
| `PORT` | Port the server listens on (default: 3000) |

---

## Project structure

```
├── server.js          ← Express backend (start here)
├── .env               ← All secrets (never commit this)
├── .env.example       ← Template for .env
├── package.json       ← Dependencies
├── public/
│   └── index.html     ← The frontend (served by Express)
└── HOW_TO_RUN.md      ← This file
```

---

## What changed from the original HTML file?

| Before | After |
|---|---|
| Firebase config hardcoded in HTML | Served from backend after auth |
| Google Sheets API key in HTML | Proxied through `/api/sheets` |
| Access code visible in HTML source | Validated server-side in `.env` |
| Single monolithic HTML file | Frontend + backend separated |

Anyone who views the browser's page source can no longer see your credentials.
