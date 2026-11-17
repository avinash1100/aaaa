# Firebase Setup Guide for Aegis Insights (Spark Free Plan)

This guide walks you through connecting the **Aegis Insights** library (`media.html`, `index.html`, and `admin.html`) to your own free Firebase project. It uses **Firebase Authentication** and **Cloud Firestore** on the free **Spark plan** (no Cloud Storage, no Cloud Functions, and no billing required).

---

## Step 1: Create a Firebase Project & Web App

1. Open the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Create a project** (or **Add project**), enter a name (for example, `aegis-learning-academy`), disable Google Analytics if you do not need it, and click **Create project**.
3. On the project overview page, click the **Web** icon (`</>`) to add a web app.
4. Enter an app nickname (for example, `Aegis Website`), leave **Firebase Hosting** unchecked (unless you host there), and click **Register app**.
5. Firebase will show a `firebaseConfig` object with keys like `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.
6. Open `assets/js/firebase-config.js` in your website files and replace the placeholder values inside `firebaseConfig` with your real values:

```js
export const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.firebasestorage.app',
  messagingSenderId: '987654321000',
  appId: '1:987654321000:web:abcdef...'
};
```

> **Note on Security:** The Firebase Web configuration in `assets/js/firebase-config.js` is **public by design**—every browser needs it to know which Firebase project to connect to. Your data and admin actions are protected on Google's servers by your **Firestore Security Rules** (Step 5), not by hiding the config.

---

## Step 2: Enable Google Sign-In

1. In the left sidebar of the Firebase Console, click **Build** > **Authentication**, then click **Get started**.
2. Open the **Sign-in method** tab and click **Google**.
3. Toggle **Enable** on, choose your support email address from the dropdown, and click **Save**.

---

## Step 3: Create Cloud Firestore in a Nearby Region

1. In the left sidebar, click **Build** > **Firestore Database**, then click **Create database**.
2. Keep the default database ID `(default)` and select a location close to your students in Bengaluru—for example, **`asia-south1 (Mumbai)`**—then click **Next**.
3. Choose **Start in production mode** and click **Create**.

---

## Step 4: Authorize Your Website Domain

1. Go to **Build** > **Authentication** > **Settings** > **Authorized domains**.
2. `localhost` is already listed for local testing (`python3 -m http.server`).
3. Click **Add domain** and enter your live production domain (for example, your Netlify, Cloudflare Pages, or custom domain such as `aegisacademy.in`) so Google Sign-In popups work on the live website.

---

## Step 5: Publish the Security Rules

1. Go to **Build** > **Firestore Database** > **Rules**.
2. Open the file `firebase/firestore.rules` from this project, copy its entire contents, and paste it into the Firebase Console Rules editor (replacing the existing rules).
3. Click **Publish**.

These rules enforce on the server that:
- Anyone can read `media` documents only when `status == 'published'`.
- Only approved staff (`admin` or `owner`) can read drafts or create, update, and delete media entries, with strict field and YouTube ID validation.
- First-time Google sign-ins can only create their own `users/{uid}` document with `role: 'pending'` (making self-promotion impossible).
- Only an `owner` can change another user's role to `admin` or back to `pending`.

---

## Step 6: Make Yourself the First Owner

Because security rules prevent anyone from promoting themselves, the very first owner is set once in the Firebase Console:

1. Serve or deploy your site and open `/admin.html` in your browser.
2. Click **Sign in with Google** and sign in with your Google account.
3. You will see the **"Waiting for owner approval"** screen showing your **Account UID**.
4. In the Firebase Console, go to **Build** > **Firestore Database** > **Data**.
5. Open the **`users`** collection and click the document matching your **UID**.
6. Edit the **`role`** field from `"pending"` to **`"owner"`** and click **Update**.
7. Return to `/admin.html` and click **Check Approval Status** (or refresh the page). You now have full access to both the **Aegis Insights** manager and the **Team** tab to approve other teachers as admins.
