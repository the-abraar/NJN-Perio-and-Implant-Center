# NJN Perio and Implant Center

Free appointment website and manual-SMS dentist app for NJN Perio and Implant Center in Azimpur, Dhaka.

## What is included

- Patient website in `public/`
- Firebase Hosting config in `firebase.json`
- Firestore rules in `firestore.rules`
- Storage rules in `storage.rules`
- Flutter dentist app scaffold in `dentist_app/`

The system uses Firebase Spark-plan services only: Firestore, Storage, Hosting, and Firebase Auth for one dentist account. There are no Cloud Functions, paid SMS APIs, or automated SMS flows.

## Website

The website includes:

- Clinic hero, services, FAQ, address, phone, and map link
- WhatsApp query box using `https://wa.me/8801779172808`
- Emergency call button
- 45-minute appointment slots from 9:00 AM to 5:00 PM
- Fridays disabled
- Real-time slot statuses: free, pending, booked
- Booking form with name, age, phone, optional description, and image upload
- Client-side validation and Firestore transaction booking
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
    "workStart": "09:00",
    "workEnd": "17:00",
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
