# Session handoff — SplitwisePRO

Read this first in a new conversation. Architecture lives in `architecture.md`, visual language in `DESIGN.md`, deploy steps in `firebase-github-setup.md`.

## Status (v1 complete, untested against a live Firebase project)

- Google sign-in (sign-up is implicit on first sign-in).
- Home dashboard: total balance / you are owed / you owe across all groups, group list, recent activity feed (last 30).
- Create group, add members by exact email search over signed-up users; unknown emails become **pending invites** auto-claimed on that user's next sign-in.
- Expenses in **INR only**: multiple payers; split equally / exact ₹ / percent / shares. Edit + delete.
- Group page: simplified "who owes whom", per-member balances, "Settle" → record payment (editable/deletable).
- Dark mode toggle. Deploy: GitHub Actions → GitHub Pages, Firebase config from GitHub Secrets.
- `npm test` covers split math + debt simplification (`src/utils/money.test.js`).

## Product decisions (chosen by user)

| Topic | Decision |
|---|---|
| Split types | Equal, exact, percent, shares |
| Payers | Multiple payers with amounts each |
| Settling | Simplified debts + "Record payment" |
| Unknown email | Pending invite, auto-join on sign-up |
| Permissions | Any member adds/edits/deletes expenses and adds members; only creator deletes group |
| Extras | Dashboard, dark mode, activity feed |
| Repo / base path | `SplitwisePRO` → `/SplitwisePRO/` |
| Firebase config | GitHub Secrets → `VITE_FIREBASE_*` env vars (deviation from architecture.md's committed `firebase-config.js`) |

## Technical decisions

- **Money = integer paise** everywhere (`amount`, `paidBy`, `split`, `balances`). Rounding leftovers go to the first people in the split so totals are exact.
- **Balances are denormalised** on `groups/{id}.balances` (`uid → paise`, positive = is owed) and updated in the same Firestore **transaction** as each expense create/edit/delete. This keeps the dashboard to one query. Trade-off: rules don't verify balance math — members are trusted.
- **Payments are expenses** with `type: "payment"`, `paidBy: {from: amt}`, `split: {to: amt}` — one code path for balance math.
- **Debt simplification** is computed client-side from balances (greedy largest-debtor → largest-creditor).
- **Activity** docs live in `groups/{id}/activity` with a copied `memberIds` so the home feed is one collection-group query (needs the composite index in `firestore.indexes.json`). New members don't see activity from before they joined.
- **User search** is exact-email only; rules allow `list` on `users` only with `limit <= 1` to prevent dumping all users.
- **Group delete** removes expenses + group in one batch (cap ~499 expenses); activity history is kept.
- Fonts: Montserrat (Gotham substitute) at 300/500/700.
- **Live updates:** every screen uses Firestore `onSnapshot`; balances, expenses, group list and activity update without refresh. Open modals deliberately don't re-render (they live on `<body>`), so in-progress input is kept; saves still use fresh data via transactions.
- **Firebase config needs only 4 keys** (`apiKey`, `authDomain`, `projectId`, `appId`). `storageBucket` / `messagingSenderId` are unused (no Storage, no FCM) — add them to `src/config/firebase.js`, `.env.example` and the workflow only if receipts or push notifications are built.

## Data model

```
users/{uid}                 { uid, email(lowercase), displayName, photoURL, updatedAt }
groups/{gid}                { name, createdBy, memberIds[], members{uid:{name,email,photoURL}},
                              pendingEmails[], balances{uid:paise}, createdAt, updatedAt }
groups/{gid}/expenses/{eid} { type:"expense"|"payment", description, amount, paidBy{uid:paise},
                              split{uid:paise}, splitType, splitInput{uid:number}, createdBy, createdAt, updatedAt }
groups/{gid}/activity/{aid} { groupId, groupName, memberIds[], actorId, actorName, text, createdAt }
```

## File map

- `src/main.js` — router + `mountSignIn` / `mountHome` / `mountGroup`.
- `src/services/db.js` — all Firestore I/O; `auth.js` — sign-in + post-login profile/invite claim.
- `src/views/` — `signin.js`, `home.js`, `group.js` (HTML strings).
- `src/components/popups.js` — group/members, expense, settle-up modals.
- `src/utils/money.js` — pure money math (tested).

## Not built (candidates for next session)

- Remove member / leave group; rename group.
- Expense date picker, categories, notes, receipts.
- Multi-currency.
- Rules-level validation of balance deltas (would need Cloud Functions).
- Pagination for long expense lists.
