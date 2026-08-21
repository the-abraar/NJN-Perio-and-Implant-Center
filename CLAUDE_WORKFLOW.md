# Claude Workflow & Decisions Log

This file tracks standing rules and setup decisions for how Claude works on this
project from this computer. Claude updates this file whenever a new rule is set
or the deploy/tooling setup changes, and commits it along with the related work.

## Standing rules (set by user)

- **No Firebase CLI steps shown to the user.** When a change needs to go live,
  Claude runs the deploy itself (see "Deploy workflow" below) instead of asking
  the user to run `firebase` commands.
- **Live site is njndental.com**, not the `*.web.app` URL. Custom domain is
  already connected in Firebase Hosting to the `njn-perio-implant-2026` project,
  so any Hosting deploy updates njndental.com automatically.
- **Commit and push to GitHub after every piece of work**, so changes are always
  rollback-able via git history (`git log`, `git revert`).

## Deploy workflow

- Firebase project is pinned in `.firebaserc` → `njn-perio-implant-2026`. No
  need to pass `--project` anymore.
- Deploys run via `tools/deploy.sh`, which wraps
  `npx firebase-tools deploy --only hosting --project njn-perio-implant-2026`.
  Claude runs this directly (`bash tools/deploy.sh`).
- `.claude/settings.json` allows `tools/deploy.sh` and `firebase deploy` /
  `npx firebase-tools deploy` commands to run without a permission prompt, so
  the deploy step doesn't stall on approval.
- Auth: Firebase CLI login is already stored on this machine
  (`~/.config/configstore/firebase-tools.json`, account
  `arafatmasudniloy@gmail.com`) — no login step needed.

## Environment notes (this machine)

- On the macOS machine, `tools/deploy.sh` does not run — its hardcoded
  `C:\Program Files\nodejs` paths are Windows-only. There the Firebase CLI is
  on PATH at `/usr/local/bin/firebase` (v15.23.0, logged in as
  `blankframe.technologies@gmail.com`), so Claude deploys with
  `firebase deploy --only hosting` directly.
- Node.js is installed system-wide at `C:\Program Files\nodejs` (v24.19.0). The
  Bash/PowerShell tool sessions Claude uses don't pick up PATH changes made
  after a session starts, so Claude invokes `npx`/`node` via the full path
  (`C:\Program Files\nodejs\npx.cmd`) rather than assuming `npx` is on PATH.
- `firebase-tools-instant-win.exe` (~235MB standalone Firebase CLI binary) sits
  in the project root and is gitignored. It's not used by the deploy workflow
  above (that uses `npx firebase-tools` instead) — kept only because the user
  hadn't confirmed whether to delete it.
- GitHub MCP server (`github`, scope: user) is configured via
  `claude mcp add`, running
  `C:\Program Files\nodejs\npx.cmd -y @modelcontextprotocol/server-github`,
  authenticated with a GitHub PAT stored in the MCP server's env config (not in
  this repo).

## Change log

- **2026-08-21** — Moved clinic hours to 5:00 PM - 10:00 PM in the site copy and
  the `defaultConfig` fallback in `public/script.js`. The live slot grid is
  driven by the Firestore `config/businessHours` document, which overrides those
  defaults, so that document still needs `workStart: "17:00"` /
  `workEnd: "22:00"`. The helper for this now lives in the repo as
  `tools/set_business_hours.sh` (it was previously left in a session
  scratchpad and lost). It PATCHes only workStart/workEnd via the Firestore
  REST API, so slotMinutes and offDays are preserved. It needs Application
  Default Credentials — the firebase CLI login does not expose a
  datastore-scoped token — so run `gcloud auth application-default login`
  once, then `tools/set_business_hours.sh 17:00 22:00`.
  Deployed to njndental.com.

- **2026-08-07** — Replaced the top-bar "+" logo with an implant-tooth image
  (`public/images/logo-tooth-implant.png`), pinned the default Firebase
  project in `.firebaserc`, added `.gitignore` for Firebase CLI artifacts,
  set up the GitHub MCP server, added the deploy-without-prompting permission
  rule, and created this log. Deployed to njndental.com.
