# Task: Secure, fix and clean up the Luxus real-estate backend (Node.js / Express / MongoDB / Socket.io)

You are working in the `server_clone` backend (Express 4, Mongoose 8, Socket.io 4, Passport Google OAuth, Stripe, Nodemailer, Winston). A full code review found critical security holes, silently broken features, and messy code. Fix them **phase by phase, in the order below**.

## Ground rules (follow these throughout)

1. **Work one phase at a time.** After each phase: summarise what you changed (file by file), list anything you could not do, and **stop and wait for my approval** before starting the next phase.
2. **Never print, log, copy or commit the contents of `.env`.** Do not change the secret values in it. You may add *new* variable names to a new `.env.example` with placeholder values only.
3. **Do not commit or push anything** unless I explicitly ask. Never add `.env` to a commit.
4. Keep the existing patterns: `asyncHandler`, `ApiResponse`, `ApiError`, `MESSAGES`/`STATUS_CODES` in `config/constants.js`, and `utils/logger.js`. Every route should respond with `ApiResponse` or throw `ApiError`.
5. Keep the frontend contract where possible (same URLs, same response shapes). If you must change a URL or response shape, list it clearly under "Breaking changes for the frontend" in your summary.
6. Don't invent features that aren't requested. If something is ambiguous, pick the safest option and write down your assumption.
7. After each phase, the server must start with `npm start` without errors (you may mock the DB connection for this check, but do not connect to the production MongoDB cluster).

---

## Phase 1: Critical security fixes

### 1.1 Stop privilege escalation to admin
- `controllers/auth.controller.js` → `register`: do **not** accept `admin` from the client. Allow only `buyer` or `seller` (default `buyer`). Reject anything else with 400.
- `controllers/auth.controller.js` → `updateUserProfile`: remove `role` from the fields a user can update. Only allow a whitelist (`username`, `phone`, `avatar`).
- `routes/userRoutes.js` → `POST /complete-google-signup`: this currently trusts `email` and `role` from `req.body`, with no proof of Google login, and it allows `admin`. Fix it:
  - In the Google OAuth callback, when `isNewUser` is true, create a **short-lived (10 min) signed JWT** with a separate secret (`GOOGLE_SIGNUP_SECRET`), containing `{ email, displayName, googleId }`. Redirect to `${FRONTEND_URL}/complete-signup?token=...` (not `?email=`).
  - `/complete-google-signup` must accept `{ token, username, role }`, verify the token, and take the email/googleId **from the token only**. Allow only `buyer` or `seller`. Save `googleId` on the user.
- Admins must only be created by a CLI script: add `scripts/createAdmin.js` (reads the email from argv and promotes that existing user to admin).

### 1.2 Ownership and mass-assignment on properties
In `controllers/property.controller.js`:
- `updateProperty`: load the property first. Allow the update only if `property.seller.equals(req.user.id)` **or** the user is admin; otherwise 403. Only apply whitelisted fields: `title, description, price, location, address, type, buildYear, size, lotSize, amenities, images, category`. Never let a seller set `status`, `rejectionReason`, `seller`, `propertyStatus` or `reviews`. If a seller edits an approved property, set `status` back to `pending`.
- `deleteProperty`: same ownership check (seller or admin).
- `addProperty`: only users with role `seller` (or `admin`) may create properties. Escape the `category` value before using it in a RegExp (or better, match on lowercase with an exact equality).

### 1.3 Lock down chat / sockets (`socketConnection.js`, `app.js`)
- **Delete** the second `io.on("connection", ...)` block in `app.js` (the `message` broadcast and `join-room` handlers). It lets any user join any room and broadcast to everyone.
- `io` is currently an implicit global. Declare it properly (`let io;` at module level) and export a `getIO()` helper.
- `handleJoinConversation`: the socket user (`socket.user.id`) **must** be either the buyer or the seller. Ignore client-supplied `buyerId` when the caller is the buyer (use `socket.user.id`). Validate all IDs with `mongoose.Types.ObjectId.isValid`.
- `handleNewMessage`: **ignore `senderId` from the client**; always use `socket.user.id`. Check that the sender is a participant. Validate `content` (string, 1–2000 chars) and `messageType` (enum).
- `handleMarkAsRead`, `handleSendReaction`, `handleEditMessage`, `handleDeleteMessage`, `handleTyping`, `handleStopTyping`: check that the socket user is a participant in the message's conversation before doing anything.
- `handleGetUserStatus`: limit `userIds` to at most 50 valid ObjectIds, and only return the status of users who share a conversation with the caller. Use a single `User.find({ _id: { $in } })` query instead of one query per ID.
- Socket auth (`middlewares/socketsToken.js`): also accept the token from the `token` cookie in `socket.handshake.headers.cookie`. On connect, schedule a disconnect when the JWT expires.
- Remove the public `GET /online` endpoint in `app.js` (it leaks the userId→socketId map).

### 1.4 Payments: stop free premium tours
- `controllers/payment.controller.js` → `createPaymentIntent`: **do not accept `amount` from the client.** Accept `{ propertyId }` (or a tour type) and compute the price on the server from a constant (e.g. `PREMIUM_TOUR_PRICE_CENTS` in `config/constants.js`). Add `metadata: { propertyId, userId }`. Require login.
- `controllers/scheduleTour.controller.js`: for premium tours, call `stripe.paymentIntents.retrieve(paymentIntentId)` and require `status === 'succeeded'`, the correct `amount`/`currency`, and matching `metadata.propertyId`. Reject a `paymentIntentId` that is already used by another tour (add a unique sparse index on `paymentIntentId`).
- Add a Stripe webhook route `POST /api/webhooks/stripe` using `express.raw({ type: 'application/json' })` and `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`. On `payment_intent.succeeded` and `payment_intent.payment_failed`, update the matching tour's `paymentStatus`. This route must be mounted **before** `express.json()`.

### 1.5 Remove dangerous endpoints
- Delete `GET /dev/get-token` and `getVerificationToken` entirely.
- `POST /api/upload` in `app.js`: delete it and replace it with an authenticated route that uses the existing `upload` from `utils/fileUpload.js` (image-only, 5 MB limit, max 10 files) and `uploadMultipleToCloudinary`. Only `seller`/`admin` may upload. Remove the old multer config from `app.js`.
- `POST /categories` in `routes/categoryRoutes.js`: admin only.

### 1.6 Tokens and cookies
- Create one helper in `helpers/auth.helper.js` to set the auth cookie: `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'` (or `'none'` + secure when the frontend is on another domain; read from env), and `maxAge` equal to the JWT lifetime. Use it in login, Google login and complete-google-signup. Remove the duplicated cookie code.
- Stop returning the JWT in the JSON body of `login` (the frontend should rely on the cookie). List this as a breaking change.
- Password reset: stop signing reset tokens with `TOKEN_SECRET`. Use `crypto.randomBytes(32).toString('hex')`, store **only its SHA-256 hash** in `resetPasswordToken`, and compare the hash on reset. Do the same for email verification tokens. Tokens are single-use.
- `ResetPass`: validate the new password (min 8 chars, at least one uppercase letter and one number) before hashing.
- `LogOut` must clear the cookie with the same options it was set with.

### 1.7 Injection and abuse protection
- Add a small `utils/escapeRegex.js` and use it everywhere user input goes into `new RegExp(...)` (`searchProperty`, `addProperty`, `getPropertiesByCategory`). Limit the search string to 100 characters.
- Enable `mongoose.set('sanitizeFilter', true)` in `config/db.js`, **and** make sure `email` fields from `req.body`/`req.query` are strings (reject objects) in login, register, forgot-password and resend-verification.
- Add `helmet()` and `express-rate-limit`:
  - login / register / forgot-password / resend-verification: 10 requests per 15 min per IP
  - contact form / newsletter: 5 per hour per IP
  - general `/api`: 300 per 15 min
- Set `express.json({ limit: '100kb' })`.
- Contact form and newsletter (`routes/contactForm.js`): the confirmation email to the user must **not** echo their message back (that turns us into a spam relay). Send a fixed "we received your message" text only. Fix the signature ("BlogsSpot ICP" → "Luxus Real Estate"). Use `process.env.EMAIL` as the `from` address.
- Login (`auth.controller.js`): check the password **before** the `isVerified` check, and do not send a new verification email from login; just return 403 "Please verify your email". Forgot-password must always return the same 200 message whether or not the email exists (no user enumeration).
- Escape user-supplied values (username, rejection reason, name, message) before putting them into HTML emails. Add a tiny `escapeHtml` util.

---

## Phase 2: Fix features that silently don't work (schema and logic)

Mongoose `strict` mode is silently dropping fields that the code writes but the schemas don't declare. Fix the schemas:

### 2.1 Schemas
- `models/Messages.js`: add `isOffer: Boolean (default false)`, `offerDetails: { amount: Number, counterAmount: Number, status: enum['pending','accepted','rejected','countered','expired'], expiresAt: Date, notes: String }`, `edited: Boolean`, `isDeleted: Boolean`, `reactions: [{ userId: ObjectId ref User, reaction: String }]`. Add an index on `{ conversationId: 1, createdAt: -1 }`.
- `models/Conversation.js`: add `pinnedBy: [ObjectId ref User]` and `status: enum['active','archived'] default 'active'`. **Remove the `messages` array** (it grows without limit and duplicates `Message.conversationId`); update all code that pushes to it. Add a unique compound index `{ propertyId, buyerId, sellerId }`.
- New `models/Notification.js`: `{ userId, type: enum['message','offer','tour','property'], content, relatedId, isRead, timestamps }` with an index on `{ userId: 1, isRead: 1, createdAt: -1 }`. Rewrite `createNotification` and `handleMarkNotificationRead` to use it instead of an embedded array on User. Add REST endpoints: `GET /api/notifications` (paginated), `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.
- `models/User.js`: add `lastActive: Date`. Mark `password`, `resetPasswordToken` and `verificationToken` with `select: false`. Fix `phone` to use `minlength`/`maxlength` (the current `min`/`max` do nothing on strings). Remove the wrong `properties` single-ObjectId field. Add `{ timestamps: true }`.
- `models/Property.js`:
  - **Remove the duplicate `owner` field and use `seller` everywhere** (`getUserProfile` counts by `owner`, and the admin lists and `singleProperty` populate `owner`; switch them all to `seller`). Write a one-off migration script `scripts/migrateOwnerToSeller.js` that copies `owner` → `seller` where `seller` is missing.
  - Add `reviewedBy: ObjectId ref User`, `reviewedAt: Date`, `{ timestamps: true }`.
  - Remove the embedded `reviews` array and the unused `const { required } = require('joi')` import.
  - Add `required` and `min` validation to `title`, `description`, `price (min 0)`.
  - Add indexes on `status`, `seller`, `category`, `price`, and a text index on `title` + `description`.
  - Move the `Category` model into its own file `models/Category.js` (remove the bogus `ref: 'Category'` on its `name`).
- `models/Reviews.js`: add `propertyId` (required, ref Property), `userId` (ref User), `timestamps`. Save `propertyId` in the review route, require login, one review per user per property (unique index), and add `GET /api/properties/:id/reviews`.
- `models/SchedulaTour.js`: remove the duplicate `startTime`/`endTime` keys, change `phone` to `String`, add `userId` (ref User, optional), `status: enum['scheduled','cancelled','completed']`, `timestamps`, and a **unique partial index on `{ propertyId, startTime }` where status is 'scheduled'** so two people can't book the same slot.

### 2.2 Offer flow logic (`socketConnection.js`)
- The buyer must be able to accept or reject a **counter-offer** made by the seller (right now only the seller can respond to anything). Rule: only the party who did **not** create the pending offer can accept/reject/counter it.
- Only one pending offer per conversation at a time; expire offers past `expiresAt`.
- Validate `amount`/`counterAmount` as positive numbers.
- Accepting an offer should set `propertyStatus: 'under offer'` (add this to the enum), **not** `'sold'`. The seller marks a property sold manually via the REST update endpoint. Reject any other open offers on that property and notify those buyers.

### 2.3 Public listing and admin logic
- `getProperties`, `searchProperty`, `relatedProperties`, `getPropertiesByCategory` and `/properties/category/:categoryId`: only return `status: 'approved'` properties. Add pagination (`page`, `limit` max 50) to all of them and return `{ items, pagination }`.
- `singleProperty`: only approved properties are public; the seller and admins can also see their own pending/rejected ones. **Do not expose seller email/phone publicly.** Return only `username` and `avatar`; buyers contact the seller through chat or a tour.
- `relatedProperties`: handle an invalid or missing id (it currently crashes on `property.category`).
- `searchProperty`: build `location` and `search` as two separate `$and` conditions (right now `location` is pushed into the same `$or` as `search`, which widens the results instead of narrowing them). Add filters: `type`, `propertyStatus`, `minSize`, `amenities`, `sort` (`price_asc`, `price_desc`, `newest`). Add a geo filter `lat`, `lng`, `radiusKm` using the existing `2dsphere` index.
- Admin controller: remove the redundant per-handler admin checks (`adminAuth` already does this). Merge `getPendingStatus`/`getApprovedStatus`/`getRejectedStatus` into one `GET /api/admin/properties?status=` handler, but keep the old routes as thin aliases. Return a correct message for rejection (currently it always says "approved"). Don't fail the whole request if the notification email fails (log it instead).
- `middlewares/adminAuth.js`: `return` after sending 403 when there is no token (it currently continues and crashes). Use status 401 for missing/invalid tokens and 403 for non-admins (not 440). Reuse `verifyToken` and add a generic `requireRole(...roles)` middleware in `middlewares/requireRole.js`.
- `middlewares/verifyToken.js`: return JSON via `ApiError` (401), not plain text; `res.send('Invalid token.', error)` is wrong. Load the user from the DB and reject deleted users.

### 2.4 Auth flow bugs
- `resendVerification`: the cooldown compares against the *expiry* time, so users are blocked for a full hour. Store `verificationEmailSentAt` and use a 2-minute cooldown.
- `register`: the unused `validateRegistration` in `utils/validation.js` should actually be applied (with `handleValidationErrors`). Add `validateLogin` to login. Use **one** validation library across the project (express-validator); remove Joi and delete `routes/validation.js`.
- `register` must not set a login cookie before the email is verified.
- Google strategy (`routes/googleRoutes.js` → move to `config/passport.js`): use `session: false` in `passport.authenticate` and remove `express-session`, `serializeUser` and `deserializeUser` (we use JWT cookies, and the in-memory session store isn't meant for production). Mount `passport.initialize()` **before** the routes. Fix the verify callback signature to `(accessToken, refreshToken, profile, done)`. Link `googleId` to an existing local account with the same email only if that email is verified.

### 2.5 Tour scheduling (`scheduleTour.controller.js`)
- Handle time zones correctly with `luxon` (or `date-fns-tz`): treat `date` + `time` from the client as **Asia/Dubai local time**, convert to UTC for storage, and use the same logic in `availableSlots`. Remove the broken `new Date(x.toLocaleString(...))` pattern.
- Bookings are allowed only from 09:00 up to the last slot that **ends** by 18:00, only on 30-minute boundaries, and never in the past.
- `availableSlots`: fetch all of that day's bookings for the property in **one** query, then compute free slots in memory. Return ISO timestamps plus display labels.
- Don't fail the booking response if a confirmation email fails; log it instead.
- Add `PATCH /api/tours/:id/cancel` (by the booker's email+token or logged-in user, or the property seller) and `GET /api/seller/tours` for sellers.

---

## Phase 3: App setup, config and cleanup

- **`app.js`:**
  - Fix `const PORT = 8000 || process.env.PORT` → `process.env.PORT || 8000`.
  - Load `dotenv` **once** at the very top of `app.js` and remove every other `require('dotenv').config()` in the project.
  - **Mount `errorHandler` last.** Merge `middlewares/errorhandler.js` into one handler that understands `ApiError` (`statusCode`, `errors`), Mongoose `ValidationError`/`CastError`/duplicate key `11000`, JWT errors, and Multer errors. It always returns JSON in the `ApiError` shape, and hides stack traces and internal messages in production. Delete the duplicate `asyncHandler` in that file.
  - Add a 404 JSON handler for unknown routes.
  - CORS: read allowed origins from `CORS_ORIGINS` (comma-separated) or `FRONTEND_URL`. Use the same list for Socket.io. Remove the weird `Cross-Origin-Opener-Policy` middleware (helmet handles it).
  - Replace all hardcoded `http://localhost:3000` URLs (Google redirects) with `FRONTEND_URL`.
  - Add `GET /health` (returns DB connection state).
  - Graceful shutdown on `SIGTERM`/`SIGINT` (close the HTTP server, Socket.io and the Mongoose connection).
  - Handle `unhandledRejection`/`uncaughtException` by logging with Winston.
  - Use Winston (`utils/logger.js`) instead of `console.log` everywhere. Add request logging (`morgan` piped into Winston, or a small middleware).
- **`config/db.js`:** use a single `MONGO_URI` env variable instead of building the URL with a hardcoded cluster host. Remove the deprecated `useNewUrlParser`/`useUnifiedTopology`. Retry the connection a few times before exiting.
- **Config validation:** add `config/env.js` that checks all required env vars at startup (with a clear error listing what is missing) and exports a typed config object. Required: `MONGO_URI, TOKEN_SECRET, FRONTEND_URL, EMAIL, APP_PASSWORD`. Optional with warnings: Google, Stripe and Cloudinary keys. Rename the misspelled `VERIFICATION_SECRECT` → `VERIFICATION_SECRET` (support the old name temporarily and log a deprecation warning).
- **`.env.example`:** list every variable with placeholder values and a one-line comment each.
- **`.gitignore`:** fix it (remove the literal `echo` line) and include `.env`, `.env.*` (but not `.env.example`), `node_modules/`, `logs/`, `uploads/`, `coverage/`. Run `git rm -r --cached .env logs uploads` (untrack only; don't delete the local files) and tell me you did it. **Do not commit.**
- **`package.json`:**
  - Add `name`, `version`, `private: true`, `engines.node >= 20`.
  - Scripts: `"start": "node app.js"`, `"dev": "nodemon app.js"`, `"test": "jest"`, `"lint": "eslint ."`.
  - Move `nodemon` to devDependencies.
  - **Remove `faker` (v6.6.6 is the sabotaged empty release)**, `body-parser`, `typeface-quicksand`, `joi` and `express-session`.
  - Add `helmet`, `express-rate-limit`, `luxon`, `morgan`.
  - Update `mongoose`, `socket.io`, `nodemailer`, `jsonwebtoken`, `express` and `multer` to current patch/minor versions, and run `npm audit fix`. Report the remaining `npm audit` findings (there are currently 21, including 1 critical and 13 high).
- **Delete dead or junk code:**
  - `controllers/example.controller.js`, `routes/example.routes.js`, `controllers/contact.controller.js` (empty), `helpers/admin.helper.js` (empty), `routes/UploadRoutes.js` (empty).
  - The unused imports (`const { off } = require("../models/User")`, the unused `nodemailer`/`bcrypt`/`jwt`/`Property` imports in `userRoutes.js`, `bcryptjs/dist/bcrypt` → `bcryptjs`).
  - The commented-out socket code in `app.js`.
  - Move `check_id.js`, `debug_script.js`, `integrity_check.js` and `test_stripe.js` into `scripts/dev/` and fix their port to read from `PORT`.
- **`routes/categoryRoutes.js`:** fix the missing `Property` import, add `return` after every early response, fix `res.status(error)`, and remove the duplicate `GET /categories` (keep one, in a `category.controller.js`). Move all inline route logic (categories, reviews, contact, newsletter, Google signup) into controllers so routes only map URLs to handlers.
- **Rename for clarity** (keep old route paths working): `SchedulaTour` → `Tour` (model, controller, routes), `resend-verfication` → `resend-verification` (keep the old path as an alias), `getDashboadStats` → `getDashboardStats`.
- Use `ApiResponse`/`ApiError` consistently in every route (contact, newsletter, reviews, categories, Google signup and upload currently don't).
- Update `README.md` with setup, env vars, scripts, folder structure and a short API route list. Update `BACKEND_OVERVIEW.md` to match the new structure.

---

## Phase 4: Tests, docs and tooling

- Add **Jest + Supertest + mongodb-memory-server**. Export `app` from `app.js` (split into `app.js` = Express app and `server.js` = HTTP + Socket.io + listen) so tests don't open a port. Write tests for at least:
  - register cannot create an admin; profile update cannot change role; complete-google-signup rejects a missing/forged token
  - a seller cannot update or delete another seller's property; a seller cannot set `status: 'approved'`
  - public listing endpoints never return pending/rejected properties
  - the premium tour is rejected when the PaymentIntent is not `succeeded` (mock Stripe)
  - double-booking the same slot returns 409
  - search with regex special characters (e.g. `(a+)+$`) does not crash
  - a user who is not a participant cannot join a conversation or send a message (use `socket.io-client` against the test server)
  - the password reset token works once and then fails
- Add ESLint (flat config, `eslint:recommended` + `plugin:n/recommended`) and Prettier. Fix all lint errors.
- Add OpenAPI docs with `swagger-jsdoc` + `swagger-ui-express` at `/api/docs` (disabled in production unless `ENABLE_DOCS=true`).
- Add a `Dockerfile` (node:20-alpine, non-root user, `npm ci --omit=dev`) and `.dockerignore`.
- Add a GitHub Actions workflow `.github/workflows/ci.yml`: install, lint, test on push/PR.

---

## Phase 5: New features (only after Phases 1–4 are approved)

Implement these with the same patterns (controller + route + validation + tests):

1. **Favourites:** `POST/DELETE /api/favorites/:propertyId`, `GET /api/favorites`.
2. **Saved searches with email alerts:** save search params; a daily job (`node-cron`) emails users new approved properties that match.
3. **Seller dashboard:** `GET /api/seller/stats` (listing counts by status, total views, tours booked, open offers). Add a `views` counter on Property, incremented on `singleProperty` (at most once per IP per property per hour).
4. **Admin user management:** `GET /api/admin/users` (paginated, filter by role), `PATCH /api/admin/users/:id/ban` (add `isBanned` to User; banned users can't log in and their sockets are disconnected), plus an `AuditLog` model that records every admin action.
5. **Tour reminders:** an email reminder 24 hours before a scheduled tour (cron job), and refunds via Stripe when a premium tour is cancelled more than 24 hours ahead.
6. **Refresh tokens:** a 15-minute access token plus a 7-day refresh token (httpOnly cookie, stored hashed in a `RefreshToken` collection, rotated on use, revoked on logout / password change). Add `POST /api/auth/refresh`.

---

## What I want back after each phase

1. A list of every changed/added/deleted file, with a one-line reason each.
2. "Breaking changes for the frontend": any changed URL, request body or response shape.
3. New env variables I need to add.
4. Anything you skipped or weren't sure about.
5. The exact commands to run (install, migrate, test, start).

**Start with Phase 1 now.**
