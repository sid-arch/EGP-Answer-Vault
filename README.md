# EGP Knowledge Hub

A shared internal Q&A system for Euler's Golden Pie.

## What this version includes

- Google Sheets as the single source of truth
- Add, edit, and delete questions from the website
- Direct Google Sheet edits appear after refresh
- Question-first accordion layout
- Nested follow-up accordions
- Compact copy, edit, and delete icons
- Three copy options:
  - Copy answer
  - Copy question + answer
  - Copy entire thread
- Autosave and live sync indicator
- Search across questions, answers, categories, and follow-ups
- Read-only emergency browser cache if Google Sheets is temporarily unreachable

## Project structure

```text
EGP-Knowledge-Hub/
├── index.html
├── styles.css
├── app.js
├── Code.gs
├── README.md
└── assets/
    ├── favicon.png
    ├── logo.png
    └── icons/
        ├── chevron-down-svgrepo-com.svg
        ├── chevron-right-svgrepo-com.svg
        ├── copy-svgrepo-com.svg
        ├── edit-3-svgrepo-com.svg
        ├── plus-svgrepo-com.svg
        ├── refresh-cw-alt-3-svgrepo-com.svg
        ├── search-svgrepo-com.svg
        ├── settings-minimalistic-svgrepo-com.svg
        └── trash-xmark-svgrepo-com.svg
```

## Google Sheets setup

1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the default code with the contents of `Code.gs`.
4. In `Code.gs`, change:

```javascript
ACCESS_KEY: 'CHANGE-THIS-TO-A-LONG-PRIVATE-KEY'
```

Use a long private value, for example:

```javascript
ACCESS_KEY: 'EGP-Hub-Private-2026-X8k92'
```

5. Click **Deploy → New deployment**.
6. Select **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone**.
9. Deploy and authorize the script.
10. Copy the web app URL ending in `/exec`.

## Connect the website

1. Open the website.
2. Click the settings icon.
3. Paste the Apps Script `/exec` URL.
4. Enter the exact same access key used in `Code.gs`.
5. Click **Save & Connect**.

Repeat this connection once on each device.

## Editing directly in Google Sheets

The site and Sheet are two-way.

- Website changes are immediately saved to the Sheet.
- Direct Sheet changes appear on the website after pressing Refresh.

The Sheet columns are:

| Column | Purpose |
|---|---|
| ID | Unique ID. Do not duplicate or casually change it. |
| Question | Main question |
| Answer | Main polished answer |
| Category | Category shown in the site |
| FollowUps_JSON | Follow-up questions and answers stored as JSON |
| CreatedAt | Creation timestamp |
| UpdatedAt | Latest edit timestamp |

For easy everyday use, edit normal questions and answers directly in the Sheet. Follow-ups are safest to edit through the website because their column uses JSON.

## Hosting

Upload the entire folder to GitHub Pages, Netlify, or Cloudflare Pages. Keep the folder structure unchanged so all icons and images load correctly.

## Important security note

The access key prevents casual unauthorized use, but it is not the same as a full login system. Keep the website URL and access key private within the EGP team.
