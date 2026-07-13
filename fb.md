

NJN Perio & Implant Center Firebase Setup Checklist
 Create new Firebase project (njn-perio-implant-2026)
 Enable Auth in Firebase Console
 Create dentist login (doctor@njnperio.com) and retrieve UID (nXfM7K8iYYaMcYgviUUO6sTdxyi1)
 Register Web App and fetch configuration details
 Save configuration to public/firebase-config.js
 Update firestore.rules and storage.rules with the dentist's Auth UID
 Initialize Firestore config/businessHours document
 Deploy Hosting and Firestore rules (skipped Storage rules as Storage is not provisioned)
 Verify patient website and dentist app credentials


Firebase Setup and Deployment Walkthrough
We have successfully completed steps 1 to 5 of the project handoff, connecting your website and Flutter dentist app to a live Firebase backend.

What We Did
1. Created Firebase Project
Created a new project NJN Perio and Implant Center (ID: njn-perio-implant-2026).
2. Registered Web App & Configuration
Registered the web app njn_perio_implant_web in the project.
Retrieved the configuration and created the file: 
firebase-config.js
3. Created Dentist User Login
Created the dentist account:
Email: doctor@njnperio.com
Password: NJNPerio2026!
UID: nXfM7K8iYYaMcYgviUUO6sTdxyi1
Replaced the REPLACE_WITH_DENTIST_AUTH_UID placeholder in both:
firestore.rules
storage.rules
Updated 
main.dart
 and 
firebase_options.dart
 in the Flutter dentist app to use these live credentials.
4. Initialized Firestore Configuration
Seeded the config/businessHours document in your live Firestore database with the operational hours:
Start: 09:00
End: 17:00
Slot duration: 45 minutes
Off Days: [5] (Fridays off)
5. Deployed Project
Deployed the HTML/JS/CSS assets to live Firebase Hosting: 👉 Live Website: https://njn-perio-implant-2026.web.app
Deployed the security rules to Cloud Firestore.
Note: Storage rules deployment was skipped since Storage requires a payment plan configuration on Google Cloud.
Next Steps for Local Testing
To run and test the dentist app locally, run the following commands in your terminal:

bash

cd dentist_app
flutter pub get
flutter run
Log in using:

Email: doctor@njnperio.com
Password: NJNPerio2026!
