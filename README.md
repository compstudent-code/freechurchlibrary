# Free Church Library

A small browser-only church library app built with HTML, CSS, JavaScript modules, Firebase Authentication, and Cloud Firestore. There is no app server, password database, or SMS sign-in.

## Church-code routing

The app intentionally accepts only the codes listed in `firebase-config.js`:

| Code | Firebase project |
| --- | --- |
| `gbcma` | `churchlibrarygbcma` |
| `test` | `church-library-test` |

Each entry needs the Firebase **Web app** `apiKey` and `appId` from that project's Firebase console. The Firebase web config is designed to be public; it is not an authorization secret. Never put service-account keys or other privileged credentials in this frontend. The app stores the selected code in this browser's local storage.

## Detailed setup from a new Firebase account

Do these steps for **each separate church project**. Start with `church-library-test` if you want to try the app first. Firebase's **project ID is permanent**: create it with the exact ID shown below (hyphens included); a display name can be changed later, but an ID cannot.

### 1. Create the Firebase project

1. Open the [Firebase console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. For the test library, use project name `church-library-test`. When Firebase asks for a Project ID, confirm it is exactly `church-library-test`. If Firebase says that ID is unavailable, stop and choose a different ID; you would then also need to change the app mapping in `firebase-config.js`.
4. Google Analytics is not needed for this app; you can leave it disabled. Finish creating the project.
5. To add the other church later, create another project with the exact project ID `churchlibrarygbcma` (no hyphens), if available. Each church's books, users, settings, and approvals live separately in its own Firebase project.

### 2. Register a web app and copy its config

Repeat for each project:

1. In that project's Firebase console, click the gear next to **Project Overview** → **Project settings** → **General**.
2. Scroll to **Your apps**. Click the Web icon (`</>`), enter an app nickname such as `Church Library Website`, and register the app. Do not select Firebase Hosting during this step; Hosting is a separate step below.
3. Firebase displays the web app configuration. In the `firebaseConfig` object, copy `apiKey` and `appId`. Use the project's displayed `authDomain` too if it differs from the standard value below. These browser config values are expected to be public; **do not copy or publish a service-account/private key**.
4. Open `firebase-config.js` in the website folder `C:\Users\josia\OneDrive\Websites\freechurchlibrary` in a text editor. Replace the placeholders:

   ```js
   test: {
     projectId: "church-library-test",
     apiKey: "PASTE_THE_TEST_PROJECT_apiKey",
     authDomain: "church-library-test.firebaseapp.com",
     appId: "PASTE_THE_TEST_PROJECT_appId"
   }
   ```

   For the `gbcma` project, paste its own `apiKey` and `appId` into that entry; never reuse the test project's values. Save the file. Keep the `projectId` and `authDomain` exactly matched to the project. Because the app is static, these values are part of the website files.

### 3. Create the Firestore database and secure its rules

1. In the Firebase console, make sure the **church-library-test** project is selected. Open **Build** → **Firestore Database** → **Create database**.
2. Choose a location near the church's users. The database location cannot easily be changed later. Choose **Start in production mode**, then create the database.
3. Open the **Rules** tab. In the website folder, open `firestore.rules`, copy its entire contents, replace the starter rules in the console, and click **Publish**. This step matters: do not leave test-mode/open rules in place.
4. If the console reports a rules syntax error, do not proceed to launch. Copy the error and exact rule line for troubleshooting. Repeat database creation and rules publication separately in the `churchlibrarygbcma` project when setting that church up.

### 4. Turn on passwordless sign-in

1. In the same project, open **Build** → **Authentication** → **Get started**.
2. Under **Sign-in method** (sometimes shown as **Providers**), enable **Google**. Pick the project's support email and save.
3. Enable **Email/Password**, then enable its **Email link (passwordless sign-in)** option. Save.
4. In Authentication → **Settings** → **Authorized domains**, add `localhost` for local testing if it is not already listed. The deployed website's hostname must also be listed before sign-in works there. Firebase Hosting's default hostname will look like `PROJECT_ID.web.app` (and `PROJECT_ID.firebaseapp.com`); add the hostnames you actually use.
5. The app does not use phone/SMS authentication. Do not enable the Phone provider for this app.

### 5. Publish church name and colors

In **Firestore Database** → **Data**, click **Start collection**. Create collection `settings`; set the document ID to `public`. Add these fields (change the name and hex colors as desired):

   ```json
   {
     "name": "Test Church Library",
     "theme": {
       "primary": "#315b4b",
       "accent": "#c9944a",
       "background": "#f5f4ef",
       "surface": "#fffefa",
       "text": "#23322b"
     }
   }
   ```

The document's fields are `name` (string) and `theme` (map). Inside the map, create `primary`, `accent`, `background`, `surface`, and `text` as strings like `#315b4b`. This public document is what lets the app show the church's name and colors as soon as its code is selected.

### 6. Publish the website with Firebase Hosting

Firebase Hosting serves the static website over HTTPS. The files are already configured for Hosting in `firebase.json`.

1. Install the current Node.js LTS release from [nodejs.org](https://nodejs.org/) on the computer that holds the website files. Close and reopen PowerShell after installation; check `node --version` and `npm --version`.
2. Open PowerShell and install the Firebase command-line tools:

   ```powershell
   npm install -g firebase-tools
   firebase --version
   ```

3. Sign the CLI into the Google account that owns the projects:

   ```powershell
   firebase login
   ```

   A browser window will open for Google authorization.
4. In the same PowerShell window, change to the website folder:

   ```powershell
   Set-Location "C:\Users\josia\OneDrive\Websites\freechurchlibrary"
   ```

5. In the Firebase console, select `church-library-test` → **Build** → **Hosting** → **Get started** to create/enable its Hosting site if needed. Then publish the existing site files from PowerShell:

   ```powershell
   firebase deploy --only hosting --project church-library-test
   ```

   The command prints a `https://...web.app` URL when complete. If the CLI reports no Hosting site/configuration, open Hosting → **Get started** in that exact project and rerun the command. Do not replace this app's existing `index.html`, `app.js`, `firebase.json`, or `firestore.rules` with a generated starter app.
6. In Authentication → Settings → **Authorized domains** for the same project, add the exact `web.app` hostname shown by the deployment (without `https://` or a path). If using the `firebaseapp.com` hostname too, add that hostname too.
7. While still in the same folder, publish the rules to the test project:

   ```powershell
   firebase deploy --only firestore:rules --project church-library-test
   ```

   The `--project` argument is important because each church has a separate ruleset. To publish to the other church project later, specify its ID explicitly: `--project churchlibrarygbcma`.
### 7. Make your account the first administrator

1. Open the deployed `https://...web.app` address from step 6, enter `test`, and sign in with your Google account. The first time, the app will say your account is waiting for approval; that is expected.
2. In Firebase console, make sure the **church-library-test** project is selected. Open **Build** → **Authentication** → **Users**. Find the user matching the Google account you just used, then copy the **User UID** exactly.
3. Open **Firestore Database** → **Data**. Create collection `admins` if it does not exist. Add a document whose document ID is the exact UID from Authentication. Add string fields `displayName` (your name) and `email` (your sign-in email), for example:

   ```json
   {
     "displayName": "Your Name",
     "email": "admin@example.org"
   }
   ```

4. Reload the deployed website. Signing in with that account should now open the **Library administration** page. The admin document must be entered in the console/trusted tooling: browser clients are deliberately forbidden from granting themselves admin status.

Do this separately in each church project. An admin UID from the test project's Authentication users will **not** identify the same person in the other project's Auth database; sign in once to that project and use its UID.

5. Add a test book from **Catalog**. Sign out and try a separate account to verify it remains pending until approved. Remove test books/data before inviting members.

### 8. Local preview (optional)

After installing Node.js, you can test the pages from PowerShell before publishing:

```powershell
Set-Location "C:\Users\josia\OneDrive\Websites\freechurchlibrary"
npx --yes http-server .
```

Open the local URL printed by the command (usually `http://127.0.0.1:8080`), enter `test`, and sign in. You must add `localhost` to Authentication's authorized domains. Stop the local server with Ctrl+C. Do not open `index.html` by double-clicking it (`file://`); the JavaScript modules and Firebase authentication require an HTTP(S) website.

### Repeat for the second church

Repeat steps 1–7 for `churchlibrarygbcma`, using the matching `gbcma` app config. Select that project in the console before editing its Firestore data, Auth users/providers, Hosting, or rules. Deploy its rules/website with `--project churchlibrarygbcma`. The church code only chooses a project; it does not create Firebase projects or databases automatically.

## Sign-in and approval flow

- Members enter their name and email to request an email sign-in link, or use Google. Email link sign-in verifies the email address; Google sign-in uses the provider's verified identity. Firebase Authentication must be configured for both.
- Firebase requires an email address for these passwordless methods; a name alone cannot authenticate a person. The app asks for their name and an email, with an optional phone number for library follow-up.
- Firebase Authentication creates its own identity on a person's first successful sign-in; a static client cannot prevent that Auth identity from being created pending your approval. Instead, the user receives **no library access** until an admin approves the pending `accessRequests/{uid}` request. Approval atomically creates `members/{uid}`, sets `access/{uid}.status` to `approved`, and updates the request. Firestore rules—not hidden UI—gate catalog and checkout access. Blocking even Auth-account creation until approval would require a trusted server/Identity Platform blocking function, outside the all-frontend design.
- Phone is optional contact information only. The app never requests SMS verification or uses phone authentication.
- After approval, members see **What would you like to do?** with separate Browse the catalog and Check out a book actions. Each opens the Firebase-backed catalog; book availability and checkout actions are shown there.
- An admin uses the Approvals, Catalog, Checkouts, and Church details tabs. Active checkouts include the borrower's name, email, and optional phone contact. Adding a book creates catalog/available-copy records. Checkout and return updates are atomic Firestore transactions governed by the rules.

## Firestore data model

- `settings/public`: church name and public color theme.
- `admins/{uid}`: pre-provisioned admin identity; immutable to app clients.
- `accessRequests/{uid}`: member-submitted request and admin decision.
- `access/{uid}`: admin-managed approval status.
- `members/{uid}`: approved member name, email, and optional phone contact.
- `books/{bookId}`: title, author, optional ISBN, total/available copy counts, and active flag.
- `checkouts/{bookId}_{uid}`: current checkout state and contact details for one member/book pair. The admin view uses the member's current profile contact information. A returned record is reused if that same member checks out the same book again; this starter version does not maintain a complete loan-history ledger.

## Free-tier and security notes

- Cloud Firestore has a no-cost quota (including daily read/write limits); monitor each project's usage. Firebase Auth also has usage and email delivery quotas. At the time this app was researched, the Spark plan's email-link sign-in delivery quota is 5 emails per day per project; verify current Firebase limits before launch.
- Firebase phone-number authentication sends billable SMS on the Blaze plan, so it is deliberately not included.
- Keep the Firestore rules deployed. The Firebase web config/API key identifies the project but does not protect data; rules do. The app limits accounts and library records to authenticated/approved people and pre-provisioned admins.
- A purely static frontend cannot safely provision initial administrators, override Firestore rules, or act as a trusted server. Project creation, Auth-provider setup, database/rules deployment, admin seeding, and backups remain trusted administrator tasks.
- The app loads public `settings/public` before sign-in. Admin-only data and member contact information are restricted by rules, but Firebase project configuration and public branding are intentionally visible to visitors.
- Firebase quotas and product terms can change; verify current pricing and limits for each project before launch.

## Official Firebase references

- [Add Firebase to a web app](https://firebase.google.com/docs/web/setup)
- [Google sign-in for web](https://firebase.google.com/docs/auth/web/google-signin)
- [Email link authentication for web](https://firebase.google.com/docs/auth/web/email-link-auth)
- [Firebase Authentication usage limits](https://firebase.google.com/docs/auth/limits)
- [Firebase phone authentication](https://firebase.google.com/docs/auth/web/phone-auth)
- [Cloud Firestore quotas](https://firebase.google.com/docs/firestore/quotas)
- [Cloud Firestore security rules](https://firebase.google.com/docs/firestore/security/get-started)

## Local preview

After filling in the web app config and completing Firebase setup, serve this directory with any static HTTP server, such as `npx http-server .`. Visit its local URL and use `gbcma` or `test`. Add the local hostname to Firebase Authentication's authorized domains if needed for your sign-in flow.
