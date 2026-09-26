# Simple WhatsApp panel: bulk send, failed, BRAND leads

Date: 2026-09-26 · Status: approved in chat, awaiting spec review

## Why

Staff need three things and nothing else:

1. Send the property-brand message to a list of leads.
2. See which numbers the message did not reach, and why.
3. See every lead who tapped **BRAND**.

It must be obvious to use without training. Today this runs on an n8n
workflow (`6xqH57hG47mGC1Om`) that only the owner can operate and that shows
results only in n8n's execution log. This moves it into the existing Next.js
app so staff get a proper login and screens.

## Decisions made in chat

| Question | Answer |
|---|---|
| Who sends and receives: n8n or Next.js? | **Next.js.** Meta allows one webhook URL per app; it moves from n8n to this app. n8n workflow is unpublished and kept archived. |
| Where does the app run? | Railway, already live. |
| How do leads get in? | Staff paste name + number rows, or upload a CSV. |
| Funnel builder? | **No.** Three plain screens. Existing funnel/batch/template screens leave the sidebar. |

## Screens

The sidebar shows only these three. Labels are Hinglish, matching how staff
talk.

### 1. Bulk bhejo — `/send`

- A table of rows: **Naam**, **Number**. Starts with 5 empty rows; "+ aur jodo"
  adds a row. A **CSV upload** fills the rows (columns: name, number; header
  row optional).
- Numbers are parsed with the existing `src/lib/phone.ts` (India default,
  mobile validation). Invalid rows are shown in red with the reason and are
  not sent. Duplicate numbers are sent once.
- Opted-out numbers (see "Opt-out") are shown as skipped.
- Button: **Messages bhejo (N)**. After sending, the page shows a summary:
  bheje gaye / skip hue, with a link to the "Nahi gaye" screen.
- Each number gets one of `property_brand_1/2/3`, picked at random, with that
  template's header image and the lead's name as body `{{1}}` (language `hi`).
  Empty name → "Sir/Madam".
- Limit: 200 rows per submit. Sends run sequentially inside the server action.
  `ponytail:` synchronous send; move to the tick worker if lists grow past a
  few hundred.

### 2. Nahi gaye — `/failed`

- Every outbound template message whose delivery status is `FAILED`, newest
  first: Naam, Number, Kab, **Wajah** (plain Hindi, from the error code),
  and an action.
- Wajah mapping (unknown codes show "Meta ne bheja nahi (code X)"):

  | Code | Wajah | Action |
  |---|---|---|
  | 131049 | Meta ne roka (marketing limit) | "Kal apne aap dobara jayega" or, after the retry also failed, "Dobara bhejo" |
  | 131026 | Is number pe WhatsApp nahi hai / message nahi pahuncha | Dobara bhejo |
  | 131050 | User ne marketing messages band kiye hain | none (opted out) |
  | 131042 | Payment ki dikkat – Meta billing check karo | Dobara bhejo |
  | 131047 | 24 ghante ki window band | Dobara bhejo |
  | 130472 | Meta experiment ki wajah se roka | Dobara bhejo |

- **Dobara bhejo** re-sends the same template and image to that number.
- A number that later succeeds (a newer message to it was delivered) drops off
  this list.

### 3. BRAND leads — `/leads`

- Every customer who tapped BRAND, newest first: Naam (WhatsApp profile name
  if we had none), Number, Kab click kiya.
- **CSV download** of the list.

## Behaviour

### Sending

`src/lib/whatsapp/adapter.ts` gains template header-image support: the
template message kind accepts an optional `headerImageUrl`, emitted as a
`header` component with an `image.link` parameter.

The three templates and their image URLs live in one constant
(`src/lib/brand/templates.ts`), the same values the n8n workflow uses today.
They are not editable in the UI.

Each send creates (or reuses) the `Customer` by `phoneE164`, updates its name
if one was given, opens or reuses the `Conversation`, and stores an outbound
`Message` with `type: TEMPLATE`, `providerMessageId`, and
`payload: { template, image, name, retryOf? }` so a re-send knows exactly what
went.

### Delivery status

Unchanged: the webhook's existing `applyStatus` already records
sent/delivered/read/failed and the failure code on the `Message`.

### BRAND tap

In `applyInboundMessage`, after the opt-out check and before the automation
engine: if the reply text or button payload, trimmed and upper-cased, is
`BRAND`, then:

- set the customer's `status = QUALIFIED` and `qualifiedAt` (first tap only),
- save the WhatsApp profile name into `name` if the customer has none,
- send the thank-you text (the same Hindi text n8n sends now) once per
  customer. It is free: it goes inside the 24-hour window the tap opened.

The adapter's inbound parser must expose the contact's profile name for this.

### 131049 auto-retry

When a status event marks a message `FAILED` with code `131049`, and that
message is not itself a retry, set `retryDueAt = failedAt + 24h` on it
(new nullable column on `messages`).

The existing tick route (`/api/automation/tick`) also re-sends due retries:
each message with `retryDueAt <= now` is sent again as a new message with
`payload.retryOf` set, and its `retryDueAt` is cleared in the same
transaction so it is sent once. A retry that fails again is not retried.

### Tick schedule

The tick route needs a caller. An n8n Schedule trigger (every 15 minutes)
calls it with the `AUTOMATION_TICK_SECRET` bearer. n8n is already paid for;
Railway cron is the alternative if n8n goes away.

### Opt-out

A `131050` failure or a reply matching the existing opt-out keywords sets
`optedOutAt`. `/send` skips opted-out numbers.

## Access

- Everyone who logs in sees the three screens. Staff logins are created with
  the existing `ADMIN` role through a small script (`npm run user:add -- email
  name`), which prints a generated password. No user-management UI.
- `/`, `/batches`, `/funnels`, `/templates`, `/tracking`, `/qualified`,
  `/settings`, `/activity` leave the sidebar. `/` redirects to `/send`.
  The old routes and their code stay in the repo, unlinked. Deleting them is
  a separate clean-up.

## Cutover (one time, done with the owner)

1. Rotate the WhatsApp access token and reset the app secret (both were pasted
   in chat earlier). Put them and the other WhatsApp values into Railway env.
2. Deploy; run the migration (`retryDueAt`).
3. In Meta → WhatsApp → Configuration, point the webhook to
   `https://<railway-url>/api/webhooks/whatsapp` with the verify token.
4. Unpublish n8n `6xqH57hG47mGC1Om`; add the n8n tick schedule.
5. Send one message to the owner's number, tap BRAND, check all three screens.

Leads captured by n8n before cutover stay in n8n's execution history; they are
not imported.

## Testing

- Unit (`node:test`): CSV/rows → valid/invalid/duplicate; random template pick
  returns one of three; error-code → Wajah mapping; BRAND detection (text,
  button payload, case, spaces); retry eligibility (131049 only, never a
  retry of a retry).
- Adapter test: template payload includes the header image component.
- Manual after deploy: step 5 of the cutover.

## Out of scope

Funnels, template editing, multi-step journeys, a no-reply timeout, user
management UI, importing n8n history, per-staff attribution of sends.
