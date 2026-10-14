# 💸 Splitly

Split shared expenses with friends and settle up in as few payments as possible.

**Live demo:** https://splitly-ko79.onrender.com (free hosting: the first load after a quiet period can take ~30–50 seconds)

## Features

- **Accounts:** sign up and log in. Passwords are hashed with bcrypt, and sessions use JWT.
- **Groups:** create a group ("Goa Trip", "Flatmates") and add friends by email.
- **Invite anyone:** add a friend who has no account yet. When they sign up with that email, they see the group and its expenses.
- **Flexible splits:** split an expense equally, by exact amounts, or by percentages, and edit it later.
- **Balances:** see who is owed and who owes at a glance.
- **Settle up:** get a short list of suggested payments and mark them as paid. A payment recorded by mistake can be deleted.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 18, TypeScript, React Router, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript, zod (input validation), express-rate-limit |
| Testing | Vitest |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | bcrypt password hashing, JSON Web Tokens |
| Hosting | Render (one service that serves both the API and the website) |

## Design decisions

**Money is stored as whole paise, never as decimals.** In JavaScript, `0.1 + 0.2 === 0.30000000000000004`. To avoid that, every amount is kept as an integer number of paise (₹12.50 → `1250`).

**Shares always add up exactly to the total.** ₹10 split three ways is ₹3.34 + ₹3.33 + ₹3.33. Percent splits round every share down, then hand the leftover paise to the people whose shares were rounded down the most (the *largest remainder method*).

**Balances are calculated when you ask for them, not stored.** Each person's balance is *what they paid − what they owe*, worked out from the expenses and payments. Nothing can drift out of sync, and deleting an expense corrects every balance automatically.

**Settling up uses a greedy algorithm.** Whoever owes the most pays whoever is owed the most, as much as possible, and the process repeats. Each payment fully settles at least one person, so a group of *n* people needs at most *n − 1* payments. ([`balances.ts`](server/src/lib/balances.ts))

**Payments are separate records.** Paying someone back never edits an expense. It adds a `Settlement` row that counts like a small expense. That keeps a full history and makes undo a simple delete.

**Login protection:** after 10 failed logins from one IP address, logging in from that address is blocked for 15 minutes (`express-rate-limit`). This makes password guessing slow.

**Tested:** the money math has unit tests (Vitest). Besides fixed examples, they generate 200 random groups and check that every balance settles to exactly ₹0 in at most *n − 1* payments. Run them with `npm test`.

**Privacy:** every group route checks that you are a member. Non-members get `404` rather than `403`, so they can't even tell a group exists.

## Project structure

```
server/
  prisma/schema.prisma      database tables
  src/lib/balances.ts       split, balance and settle-up math
  src/lib/*.test.ts         unit tests for the money math
  src/routes/               auth, groups, expenses, settlements
  src/middleware/           login check, error handling
client/
  src/pages/                Login, Signup, Home (groups), GroupPage
  src/components/group/     balances, add-expense form, activity list
```

## Run it locally

You need Node.js 20+ and a free [Neon](https://neon.tech) Postgres database.

```bash
npm install
cp server/.env.example server/.env   # then fill in DATABASE_URL and JWT_SECRET
npm run db:push                      # create the tables
npm run dev                          # website on http://localhost:5173, API on :4000
npm test                             # run the unit tests
```

## API

All routes except signup and login need an `Authorization: Bearer <token>` header. Amounts are sent in rupees and returned in paise.

| Method | Route | What it does |
|---|---|---|
| POST | `/api/auth/signup` | Create an account (or claim an invite) |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | The logged-in user |
| GET / POST | `/api/groups` | List your groups / create one |
| GET | `/api/groups/:id` | A group and its members |
| POST | `/api/groups/:id/members` | Add a member by email |
| GET | `/api/groups/:id/expenses` | Expenses, payments, balances and suggested payments |
| POST | `/api/groups/:id/expenses` | Add an expense (`equal`, `exact` or `percent` split) |
| PUT | `/api/groups/:id/expenses/:expenseId` | Edit an expense |
| DELETE | `/api/groups/:id/expenses/:expenseId` | Delete an expense |
| POST | `/api/groups/:id/settlements` | Record a payment |
| DELETE | `/api/groups/:id/settlements/:settlementId` | Delete a payment |
