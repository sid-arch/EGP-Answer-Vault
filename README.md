# EGP Knowledge Hub — Ultimate

## What it includes
- Google Sheet as the single source of truth
- Two-way editing: website writes to the Sheet; direct Sheet edits appear after refresh
- Priority levels: Critical, High, Medium, Low
- Sort by priority, update date, creation date, alphabetically, category, or follow-up count
- Category and priority filters
- Search across questions, answers, follow-ups, tags, and notes
- Nested answer/follow-up accordions
- Three copy modes
- Internal notes and tags
- Auto-refresh, offline cache, sync indicator
- Presentation view
- Keyboard shortcuts: Cmd/Ctrl+K search, Cmd/Ctrl+N new question

## Google Sheets setup
1. Create or open the Google Sheet that will store the hub.
2. Open Extensions > Apps Script.
3. Replace the editor contents with `Code.gs` from this folder.
4. Change `CHANGE-THIS-TO-A-LONG-PRIVATE-KEY` to a private key.
5. Deploy > New deployment > Web app.
6. Execute as: Me. Who has access: Anyone.
7. Copy the `/exec` URL.
8. Open the website, select Settings, enter the URL and the same key.

The script automatically creates or upgrades the `EGP_Knowledge_Hub` tab with these columns:
ID, Question, Answer, Category, Priority, Tags, Notes, FollowUps_JSON, CreatedAt, UpdatedAt.

## Hosting
Upload everything in this folder to GitHub Pages, Netlify, or Cloudflare Pages. Keep the same folder hierarchy. Replace the placeholder files inside `assets/` with your own logo, favicon, and SVGs using the exact same filenames.

## Direct Sheet editing
You may edit Question, Answer, Category, Priority, Tags, Notes, CreatedAt, and UpdatedAt directly. Be careful with ID and FollowUps_JSON; malformed values can break an entry's relationships.
