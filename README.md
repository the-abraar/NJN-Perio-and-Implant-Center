# NJN Perio and Implant Center

Free appointment website and manual-SMS dentist app for NJN Perio and Implant Center in Azimpur, Dhaka.

## What is included

- Patient website in `public/`
- Firebase Hosting config in `firebase.json`
- Firestore rules in `firestore.rules`
- Storage rules in `storage.rules`
- Flutter dentist app scaffold in `dentist_app/`

The system uses Firebase Spark-plan services only: Firestore, Hosting, and Firebase Auth for one dentist account. The website no longer uploads to Storage; patients send photos on WhatsApp instead. There are no Cloud Functions, paid SMS APIs, or automated SMS flows.

## Website

The website includes:

- Clinic hero, services, FAQ, address, phone, and map link
- WhatsApp query box using `https://wa.me/8801779172808`
- Emergency call button
- 45-minute appointment slots from 5:00 PM to 10:00 PM
- Fridays disabled
- Real-time slot statuses: free, pending, booked
- Booking form with name, age, phone, and optional description (no file upload: a hint asks patients to send photos or X-rays on WhatsApp)
- Client-side validation and Firestore transaction booking
- After a request is saved, an "Also tell the clinic on WhatsApp" button opens a message pre-filled with the slot time and the patient's first name
- If a booking fails, a plain message asks the patient to call the clinic (+880 1779-172808) and offers the same WhatsApp button, instead of showing a raw Firebase error
- Accessibility features including skip link, focus styles, live regions, and keyboard-friendly modal controls

## Firebase setup

1. Create a Firebase project.
2. Enable Firestore.
3. Enable Storage.
4. Enable Firebase Auth with email/password.
5. Create one dentist user and copy that user's UID.
6. Replace `REPLACE_WITH_DENTIST_AUTH_UID` in `firestore.rules` and `storage.rules`.
7. Copy `public/firebase-config.sample.js` to `public/firebase-config.js`.
8. Paste the Firebase web app config into `public/firebase-config.js`.
9. Add this Firestore document:

```json
{
  "collection": "config",
  "document": "businessHours",
  "data": {
    "workStart": "17:00",
    "workEnd": "22:00",
    "slotMinutes": 45,
    "offDays": [5]
  }
}
```

## Local website preview

```bash
python3 -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Booking flow check

`tools/booking_e2e.mjs` books a slot in headless Chrome against the Firestore and Hosting emulators (project `demo-njn`, never the live project) and checks that both Firestore docs are written with `fileURL: null`, that the WhatsApp button appears, that pressing Enter after a saved request does not submit it again, that Tab stays inside the booking modal, that a refused booking shows the friendly message, and that nothing requests Storage. It needs Java, Chrome, and two npm packages installed outside the repo:

```bash
npm i --prefix /tmp/njn-e2e puppeteer-core@23 firebase-tools
NODE_PATH=/tmp/njn-e2e/node_modules PATH=/tmp/njn-e2e/node_modules/.bin:$PATH node tools/booking_e2e.mjs
```

It uses ports 18940-18944 by default; set `E2E_PORT` to move them.

## Security rules

- Anyone can read `slotStatus` and `config`; only the dentist reads `appointments` and uploaded images.
- A patient booking must write the `appointments/slot_<millis>` doc and its `pending` `slotStatus` doc in the same batch or transaction, for a slot in the next 60 days. Neither doc can be written alone.
- A slot the dentist declined (`cancelled`) can be booked again the same way. Pending and booked slots cannot be overwritten.

Run the emulator tests (demo project, nothing touches the live Firebase project; needs Java):

```bash
npm ci
npm run test:rules
```

## Deploy website

```bash
firebase deploy --only hosting,firestore:rules,storage
```

## Dentist app setup

The Flutter scaffold lives in `dentist_app/`.

1. Replace placeholder values in `dentist_app/lib/firebase_options.dart`.
2. Replace `dentistEmail` and `dentistPassword` in `dentist_app/lib/main.dart`.
3. Run:

```bash
cd dentist_app
flutter pub get
flutter run
```

For production, prefer moving the dentist email/password out of source code before distributing the app. The current scaffold is intentionally simple so the doctor can test the free manual-SMS workflow quickly.

## Manual SMS workflow

1. Patient submits a request on the website.
2. Firestore slot status becomes `pending`.
3. Dentist app shows the pending request.
4. Dentist taps Accept or Delay.
5. Native SMS app opens with a pre-filled confirmation.
6. Dentist sends the message manually.
7. Dentist returns to the app and confirms the SMS was sent.
8. Firestore status becomes `booked`.

Avoid marks the request `cancelled`, which makes the slot reusable on the website.

