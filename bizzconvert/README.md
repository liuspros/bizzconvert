# BizzConvert: landing + booking page

Single-file landing page with a consultant booking flow. Bookings save to **Firebase Firestore**. No build step: it is plain HTML, CSS and JS.

```
bizzconvert/
├── index.html        # the whole site + booking logic (edit the CONFIG block near the bottom)
├── firestore.rules   # security rules to paste into Firebase
└── assets/
    ├── logo-mark.png # transparent Z mark (nav, footer)
    ├── logo-dp.png   # full DP (social preview)
    ├── favicon.png
    └── leah.jpg      # ADD THIS: Leah's photo (shows in the About section)
```

## 1. Edit the CONFIG block (`index.html`, search for `CONFIG`)

| Key | What to set |
|---|---|
| `whatsapp` | Leah's WhatsApp Business number, international format, no `+` (e.g. `2348012345678`) |
| `instagram` | Her Instagram URL |
| `slotTimes` / `workDays` / `daysAhead` | Her availability |
| `services[].price` | Prices shown on the form (the strategy session price `₦10,000` is a placeholder) |
| `firebase` | Your Firebase web config (step 2) |

Also update the matching prices in the **Services** cards (HTML) if you change them.

## 2. Firebase setup

1. Firebase console > **Add project** (Analytics not needed).
2. **Build > Firestore Database > Create database** (production mode, region `europe-west` or closest).
3. **Project settings > Your apps > Web (`</>`)** > register app > copy the `firebaseConfig` values into `CONFIG.firebase`.
4. **Firestore > Rules** > paste the contents of `firestore.rules` > **Publish**.
   Replace `LEAH_EMAIL@gmail.com` in the rules with the Google account she signs in with.
5. Add your domain under **Authentication > Settings > Authorized domains** only if you later add sign-in.

Until step 3 is done the page runs in **demo mode** (bookings saved in the browser only), so you can preview it safely.

## 3. How the data is stored

| Collection | Who can read | Contents |
|---|---|---|
| `slots/{date_HHMM}` | Anyone (needed to grey out taken times) | `date`, `time` only. No personal data |
| `bookings/{date_HHMM}` | Only Leah's account | name, WhatsApp, Instagram, niche, problem, service, status |

Each booking is written together with its slot in one atomic batch. Slots are **create-only** in the rules, so if two people pick the same time, the second write is rejected and they see "that slot was just taken".

**Viewing bookings:** Firebase console > Firestore > `bookings`. (The rules also allow her verified Google account to read them if you later build a small admin page.)

## 4. Deploy

- **Vercel / Netlify:** drag the folder in, or connect the repo. No settings needed.
- **Firebase Hosting:** `firebase init hosting` (public dir `.`, single-page: No), then `firebase deploy`.

## 5. Before going live checklist

- [ ] WhatsApp number set (the floating button and confirmation link use it)
- [ ] Firebase config pasted, rules published
- [ ] `assets/leah.jpg` added (or remove the About photo block)
- [ ] Make a test booking, check it appears in Firestore, then delete it
- [ ] Prices match the Services cards and the booking form
- [ ] Open on a phone and test the full flow

## Known limits

- Bookings send no automatic email or WhatsApp message. Leah checks Firestore, and the customer is told to confirm on WhatsApp. If you want automatic alerts later, add a Cloud Function (needs the Blaze plan) or a Make/Zapier hook on new `bookings` docs.
- Anyone could script fake bookings against the public `create` rule (there is a honeypot field and strict validation, but no CAPTCHA). If spam appears, enable **Firebase App Check** with reCAPTCHA.
