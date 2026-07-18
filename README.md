# InternShield — Updated Project

This is the full updated project: GitHub App auth, PR-per-finding auto-fix, dynamic
secret scanning, Resend email, Cloudinary avatars, per-account light/dark theme,
and a Profile page.

## Latest round of changes (this update)

1. **Expanded file coverage** — extension list moved to one shared file
   (`server/utils/fileExtensions.js`) and grown from ~12 extensions to ~35
   (PHP, C#, C/C++, Rust, Swift, Vue, Svelte, SQL, shell scripts, Terraform,
   HTML, Dockerfile/Makefile by exact name, etc). Every part of the codebase
   that reads files now imports from this one place instead of three
   independent copies that could drift.
2. **Full-repo scanning, not just the latest commit's diff** — manual "Scan Now"
   previously only looked at files changed in the most recent commit, which
   under-scanned repos with no very-recent activity. It now walks the whole
   git tree (capped at 300 files for App-authenticated repos, 60 for
   unauthenticated public repos, to stay bounded/within rate limits).
3. **Vulnerability detection** (`server/utils/vulnPatterns.js`) — a second
   pattern category alongside secrets: SQL/NoSQL injection, command injection,
   XSS, SSRF, path traversal, insecure crypto/hashing, weak randomness for
   tokens, JWT `alg:none`, disabled TLS verification, unsafe deserialization,
   permissive CORS + credentials, prototype pollution, open redirects.
   Same honesty caveat as the secret scanner: these are syntactic/pattern-based
   checks (the same class as Semgrep/Bandit's free rule tiers), not full
   dataflow/taint analysis — real signal, not a guarantee of completeness.
4. **File/folder picker** — after connecting a repo (GitHub App or public),
   a modal shows the full file tree and lets you pick exactly which files get
   scanned. That selection is saved (`Project.selectedPaths`) and applies to
   every future scan, including webhook-triggered ones. Editable later from
   Settings ("✏️ Edit files"). Leaving everything selected scans the whole repo.
5. **Connect UI moved to the Dashboard** — GitHub App install/repo-picker,
   public repo browsing, and manual zip upload are now a collapsible panel at
   the top of Home, not in Settings. Settings is now purely account-level
   config: GitHub identity status, notification email preference, and
   per-repo scan-type toggles + file selection editing.

## What changed vs. the previous version

**Backend**
- `services/githubAppAuth.js` — new. Handles the GitHub App JWT, installation tokens,
  and the OAuth identity exchange. This fully replaces personal access tokens.
- `routes/github.js` — new. Login-with-GitHub, "install the app" flow, repo listing.
- `services/scanner.js` + `utils/secretPatterns.js` — rewritten. ~35 provider-specific
  signatures (AWS, Stripe, GitHub, OpenAI, Mongo/Postgres URIs, private keys, etc.)
  instead of the old 5 generic regexes, plus a tuned entropy detector with a
  skip-list for lockfiles/minified bundles/tests.
- `services/gptService.js` — added `classifyAmbiguousFindings`, the AI second-opinion
  pass for anything the entropy detector flags but no signature matches. This is what
  makes detection "dynamic" beyond the hardcoded pattern list — see note below on limits.
- `services/prService.js` — new. Opens **one PR per fixable finding**, never commits
  directly to any branch. Only findings the AI marks `fixable: true` with a concrete
  `fixDiff` get a PR; anything requiring an actual credential rotation does not.
- `services/emailService.js` — rewritten for Resend (was nodemailer/Gmail).
- `services/cloudinaryService.js` — new. Avatar upload/replace.
- `routes/user.js` — new. Profile, avatar upload, theme, email preference.
- `models/User.js` — added GitHub identity fields, `githubInstallations[]`, `theme`,
  `emailPreference`, `avatarUrl`.
- `models/Project.js` — `installationId` replaces the old PAT-based connection.
- `models/ScanReport.js` — findings now carry `confidence`, `detectionMethod`,
  `fixable`, `prUrl`, `prStatus`.

**Frontend**
- `theme/styles.js` — new single source of truth for colors + the `RISK_CONFIG` /
  `SEVERITY_CONFIG` objects that were previously copy-pasted across three pages.
- `context/ThemeContext.jsx` — theme is fetched/saved via `/api/user/theme`, so it
  follows the account across devices rather than living in localStorage.
- `pages/Profile.jsx` — new. Avatar upload, display name, theme picker.
- `pages/GithubCallback.jsx` — new. Landing page for the GitHub OAuth redirect.
- `pages/Settings.jsx` — rewritten. Connect the GitHub App, pick an installation,
  browse + connect repos (no more manual repo URL + PAT form), per-repo scan
  toggles, email-notification preference.
- `components/Layout.jsx` — profile avatar (always visible, top right) + theme toggle.

## Honest scope notes — read before demoing

1. **"Detect all secrets" isn't literally achievable** — no tool does this with
   certainty, including GitHub Advanced Security. What's implemented: ~35 real
   provider signatures (very low false-positive rate) + entropy detection for
   anything unrecognized, with an AI pass that reads surrounding code context to
   decide if an entropy hit is plausible. That's meaningfully broader than the
   original 5 regexes, but it's still probabilistic for the entropy tier.
2. **Auto-fix PRs only cover mechanical fixes** — e.g. hardcoded value →
   `process.env.X`, removing a stray `console.debug`. A leaked real secret can't be
   "fixed" by editing code — the actual key still needs manual rotation at the
   provider. The PR description says this explicitly.
3. **The fix-diff mechanism replaces a single line** based on the line number Groq
   was given. It's intentionally simple/predictable rather than doing a fuzzy
   multi-line patch — safer for something that opens PRs automatically.
4. `.env` files are still excluded from being scanned/committed by the PR service.

## Setup

### 1. Backend
```
cd server
cp .env.example .env   # fill in every value
npm install
npm run dev
```

### 2. Frontend
```
cd client
cp .env.example .env
npm install
npm start
```

### 3. GitHub App — confirm these on the app's settings page
- Callback URL: `https://algearithm.xyz/auth/github/callback` → actually used:
  `${BACKEND_URL}/api/github/callback` (update the app's callback URL to match
  your real backend domain if `algearithm.xyz` routes only the frontend — see below)
- Webhook URL: `${BACKEND_URL}/api/webhook`
- Permissions: Contents (R&W), Pull requests (R&W), Metadata (R), Commit statuses (R&W)
- Events: push, pull_request

### 4. DNS (still pending your decision from chat)
If you go with the subdomain split:
- `algearithm.xyz` / `www` → CNAME → your Vercel deployment
- `api.algearithm.xyz` → CNAME → your Render deployment

Then set `BACKEND_URL=https://api.algearithm.xyz` and `CLIENT_URL=https://algearithm.xyz`
in the server env, and `REACT_APP_API_URL=https://api.algearithm.xyz/api` in the client env,
and update the GitHub App's callback/webhook URLs to match.

### 5. Rotate before deploying
Every credential that was pasted into the chat during setup (Mongo, JWT secret,
GitHub App private key/secret, Cloudinary, Resend) should be treated as exposed.
Generate fresh values and drop them straight into Render's env editor — never
back into a chat.
