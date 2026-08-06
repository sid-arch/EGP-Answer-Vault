# EGP Answer Vault — Shared Google Sheets Edition

This version uses **Google Sheets as the source of truth**. Every connected device reads the same questions from the sheet and writes all additions, edits, and deletions back to it.

## How it works
1. Website opens.
2. Website downloads the latest vault from Google Sheets.
3. A save, edit, or delete updates Google Sheets.
4. The website reloads the sheet so the screen matches the shared database.
5. A local cache is used only if Google Sheets is temporarily unreachable.

## Google Sheets setup
1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Delete the default code and paste the contents of `Code.gs`.
4. In `Code.gs`, replace:

   `CHANGE-THIS-TO-A-LONG-PRIVATE-KEY`

   with a long private key known only to the EGP team.
5. Click **Deploy → New deployment**.
6. Select **Web app**.
7. Execute as: **Me**.
8. Who has access: **Anyone**.
9. Click **Deploy** and copy the `/exec` Web App URL.

## Connect the website
1. Open `index.html` or your hosted website.
2. Click the gear icon.
3. Paste the Apps Script `/exec` URL.
4. Enter the exact same private access key used in `Code.gs`.
5. Save the connection.

Repeat the connection step once on each device/browser. After that, all devices share the same live vault.

## Host it for multiple devices
Upload all files in this folder to GitHub Pages, Netlify, or Cloudflare Pages. Use the same hosted URL on every device.

## Updating Apps Script later
After changing `Code.gs`:
1. Open Apps Script.
2. Click **Deploy → Manage deployments**.
3. Edit the existing deployment.
4. Choose **New version**.
5. Deploy again.

The web app URL normally stays the same when you update the existing deployment.

## Important security note
The access key prevents casual unauthorized use, but a purely front-end website cannot provide bank-grade secrecy because authorized browsers must know the key. Keep the hosted URL private and use this only for internal EGP operational content—not passwords, financial records, or sensitive participant data.
