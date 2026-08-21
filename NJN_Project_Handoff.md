# NJN Perio and Implant Center - Project Handoff

Date: May 7, 2026

## What Is Done

The repository now contains a free appointment system scaffold for NJN Perio and Implant Center.

### Patient Website

Location: `public/`

Completed:

- Responsive homepage for NJN Perio and Implant Center.
- Clinic information, address, phone numbers, Google Maps link, and emergency call button.
- Services section for routine exam, cleaning, X-rays, and gum treatment.
- FAQ section for common patient questions.
- WhatsApp query form that opens a pre-filled WhatsApp message to the clinic number.
- Appointment picker for the next 30 days.
- Friday appointments disabled.
- 45-minute slots from 5:00 PM to 10:00 PM.
- Slot statuses: Free, Pending, and Booked.
- Booking form with name, age, phone, optional description, and optional image upload.
- File validation for image-only uploads under 5 MB.
- Firestore transaction logic to reduce double-booking risk.
- Accessibility basics: skip link, focus states, live status messages, keyboard-friendly modal, and responsive layout.

### Firebase Files

Completed:

- `firebase.json` for Firebase Hosting, Firestore rules, and Storage rules.
- `firestore.rules` for public appointment reads, patient pending requests, and dentist-only updates.
- `storage.rules` for patient image uploads under 5 MB and dentist-controlled updates/deletes.
- `public/firebase-config.sample.js` as a template for the real Firebase web config.

### Dentist Flutter App

Location: `dentist_app/`

Completed:

- Basic Flutter scaffold.
- Firebase Auth sign-in placeholder for the dentist account.
- Real-time pending appointment list.
- Appointment detail screen with patient info and optional uploaded image.
- Accept flow: opens native SMS app with a confirmation message, then asks the doctor to mark as booked.
- Delay flow: doctor picks a new date/time, app checks for conflicts, opens SMS, then marks as booked.
- Avoid flow: marks request as cancelled so the website can reuse the slot.

### Documentation

Completed:

- Root `README.md` updated with setup, deploy, and workflow notes.
- `dentist_app/README.md` added for Flutter app setup.

## What To Do Now

### 1. Create Firebase Project

Create a Firebase project on the free Spark plan.

Enable:

- Firestore Database
- Firebase Storage
- Firebase Hosting
- Firebase Authentication with Email/Password

### 2. Create Dentist Login

Create one Firebase Auth user for the dentist.

Then copy that user's UID and replace:

- `REPLACE_WITH_DENTIST_AUTH_UID` in `firestore.rules`
- `REPLACE_WITH_DENTIST_AUTH_UID` in `storage.rules`

### 3. Add Website Firebase Config

Copy:

`public/firebase-config.sample.js`

to:

`public/firebase-config.js`

Then paste the Firebase web app config into that file.

### 4. Add Business Hours Config

Create this Firestore document:

Collection: `config`

Document ID: `businessHours`

Data:

```json
{
  "workStart": "17:00",
  "workEnd": "22:00",
  "slotMinutes": 45,
  "offDays": [5]
}
```

### 5. Deploy Firebase Rules And Website

Install Firebase CLI if needed, login, then run:

```bash
firebase deploy --only hosting,firestore:rules,storage
```

### 6. Configure Flutter App

In `dentist_app/lib/firebase_options.dart`, replace all placeholder Firebase values.

In `dentist_app/lib/main.dart`, replace:

- `doctor@example.com`
- `CHANGE_ME`

with the dentist's Firebase Auth email and password.

For a production build, move those credentials out of source code before distributing the app.

### 7. Test The Full Flow

Test these items before real patient use:

- Website loads on mobile and desktop.
- Fridays cannot be booked.
- Slots update when date changes.
- Booking form validates name, age, and phone.
- Image upload rejects non-images and files over 5 MB.
- Patient request creates a Pending slot.
- Dentist app shows the pending request.
- Accept opens SMS with the correct confirmation text.
- Mark as Booked changes the website slot to Booked.
- Avoid makes the slot reusable.
- Delay does not allow choosing an already pending or booked slot.

## Known Placeholders

The project will not connect to Firebase until these are replaced:

- `public/firebase-config.js`
- `dentist_app/lib/firebase_options.dart`
- Dentist email/password placeholders in `dentist_app/lib/main.dart`
- Dentist UID placeholders in Firebase rules

## Current Verification

Completed locally:

- Website JavaScript syntax check passed.
- Static website preview returned HTTP 200.
- Flutter analysis was not run because Flutter/Dart is not installed in this workspace.

