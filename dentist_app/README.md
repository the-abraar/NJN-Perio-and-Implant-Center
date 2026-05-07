# NJN Dentist App

Flutter scaffold for manually approving NJN appointment requests and opening the native SMS app with pre-filled confirmation text.

## Setup

1. Replace placeholders in `lib/firebase_options.dart`.
2. Replace `dentistEmail` and `dentistPassword` in `lib/main.dart`.
3. Enable Firebase Auth email/password and create the dentist account.
4. Put the dentist user's UID into the root `firestore.rules` and `storage.rules`.
5. Run `flutter pub get`.
6. Run `flutter run`.

## Notes

- Accept opens the native SMS app, then asks whether the SMS was sent before marking the slot booked.
- Delay asks for a new date and time, checks for a pending/booked conflict, opens SMS, then marks booked.
- Avoid marks the request cancelled so the website can reuse the slot.
