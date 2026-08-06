# EGP Answer Vault

A premium internal Q&A knowledge base for Euler's Golden Pie.

## What it includes
- Add, edit, delete, search, filter, and sort questions
- Store polished answers
- Add unlimited prospective follow-up questions and answers
- Category and tag support
- Local browser storage for instant safety
- Optional Google Sheets backup using Apps Script

## Open the website
Open `index.html` in a browser, or upload the folder to GitHub Pages / Netlify.

## Google Sheets backup setup
1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the default code with the contents of `Code.gs`.
4. Click **Deploy → New deployment**.
5. Choose **Web app**.
6. Execute as: **Me**.
7. Who has access: **Anyone**.
8. Deploy and copy the Web App URL.
9. Open the website, click the gear icon, and paste that URL.

The website saves locally first, then sends a backup copy to Google Sheets.

## Important
For internal use, keep the deployed site URL private. Anyone who can access the website can view the locally stored data in that browser profile.
