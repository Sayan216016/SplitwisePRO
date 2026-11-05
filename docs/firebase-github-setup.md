# Firebase + GitHub setup (one-time manual steps)

Site URL after setup: `https://<your-github-username>.github.io/SplitwisePRO/`

## 1. Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `splitwisepro`). Google Analytics is optional.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Pick a support email → **Save**.
3. **Authentication → Settings → Authorized domains → Add domain**: `<your-github-username>.github.io`
   (`localhost` is already there for local dev).
4. **Build → Firestore Database → Create database** → choose a location (e.g. `asia-south1` Mumbai) → **Start in production mode**.
5. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register app (no Hosting needed).
   Copy these four values from the `firebaseConfig` shown:
   `apiKey`, `authDomain`, `projectId`, `appId`.

## 2. Deploy Firestore rules + index

Option A — Firebase CLI (recommended, deploys both):

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore
```

Option B — Console:

- **Firestore → Rules**: paste the contents of `firestore.rules` → **Publish**.
- **Firestore → Indexes → Composite → Create index**:
  Collection ID `activity`, scope **Collection group**, fields `memberIds` **Array contains**, `createdAt` **Descending**.
  (Or just open the app — the browser console error for the activity feed contains a one-click link to create it.)

Re-deploy rules any time `firestore.rules` changes; they are **not** part of the GitHub Pages build.

## 3. Local development

```bash
cp .env.example .env.local    # fill in the four values from step 1.5
npm install
npm run dev                   # http://localhost:5173/SplitwisePRO/
npm test
```

## 4. GitHub

1. Push this repo to GitHub as **`SplitwisePRO`** (the name must match `base` in `vite.config.js`).
2. **Settings → Secrets and variables → Actions → New repository secret** — add four secrets:

   | Name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `main` (or **Actions → Deploy to GitHub Pages → Run workflow**). The workflow runs tests, builds and deploys.

## Troubleshooting

- **"Firebase config missing"** on the live site → a secret is missing/misnamed; re-run the workflow after fixing.
- **`auth/unauthorized-domain`** → step 1.3 not done for the exact domain.
- **"Missing or insufficient permissions"** → rules not deployed (step 2).
- **Activity feed empty + console "requires an index"** → create the index (step 2).
- **Blank page / 404 assets** → repo name differs from `base` in `vite.config.js`.
