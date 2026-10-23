# Free Church Library

A small browser-only church library app built with HTML, CSS, JavaScript modules, Firebase Authentication, and Cloud Firestore. There is no app server, password database, or SMS sign-in.

## Firebase configuration

The app identifies the library by Firebase `projectId`. Firebase configuration is **not** stored in a JavaScript file, local storage, or a database. The app reads config from URL query parameters; if required values are missing, it displays a form for the Firebase settings. Settings entered in the form remain in memory for the current page visit. The email sign-in return URL carries the settings so sign-in can complete in the correct project.

The URL parameter names match Firebase's Web app config:

| Parameter | Required | Firebase field |
| --- | --- | --- |
| `apiKey` | Yes | `apiKey` |
| `authDomain` | Yes | `authDomain` |
| `projectId` | Yes | `projectId` |
| `appId` | Yes | `appId` |
| `storageBucket` | No | `storageBucket` |
| `messagingSenderId` | No | `messagingSenderId` |
| `measurementId` | No | `measurementId` |
| `databaseURL` | No | `databaseURL` |

## Detailed setup from a new Firebase account

Do these steps for **each separate church project**. Start with `church-library-test` if you want to try the app first. Firebase's **project ID is permanent**: create it with the exact ID shown below (hyphens included); a display name can be changed later, but an ID cannot.

### 1. Create the Firebase project

1. Open the [Firebase console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. For the test library, use project name `church-library-test`. When Firebase asks for a Project ID, confirm it is exactly `church-library-test`. If Firebase says that ID is unavailable, choose the ID Firebase offers and use that actual ID in the URL's `projectId` parameter.
4. Google Analytics is not needed for this app; you can leave it disabled. Finish creating the project.
5. To add the other church later, create another project with the exact project ID `churchlibrarygbcma` (no hyphens), if available. Each church's books, users, settings, and approvals live separately in its own Firebase project.

### 2. Register a web app and copy its config

Repeat for each project:

1. In that project's Firebase console, click the gear next to **Project Overview** → **Project settings** → **General**.
2. Scroll to **Your apps**. Click the Web icon (`</>`), enter an app nickname such as `Church Library Website`, and register the app.
3. Firebase displays the web app configuration. In the `firebaseConfig` object, copy `apiKey` and `appId`. Use the project's displayed `authDomain` too if it differs from the standard value below. These browser config values are expected to be public; **do not copy or publish a service-account/private key**.
4. Copy the Web app config values somewhere private for your own convenience, then place them in the URL as described below. Do not create or edit a JavaScript config file. Each project has its own `apiKey`, `authDomain`, `projectId`, and `appId`; never mix values from different Firebase projects.

### Build the GitHub Pages URL

After enabling GitHub Pages for this repository, note its site URL, usually `https://YOUR-GITHUB-NAME.github.io/freechurchlibrary/`. Add the query parameters using Firebase's values:

```text
https://YOUR-GITHUB-NAME.github.io/freechurchlibrary/?apiKey=YOUR_API_KEY&authDomain=church-library-test.firebaseapp.com&projectId=church-library-test&appId=YOUR_APP_ID
```

Replace `YOUR-GITHUB-NAME`, `YOUR_API_KEY`, and `YOUR_APP_ID` with the real values from your GitHub Pages site and Firebase **Web app**. Do not include the Firebase config's JavaScript braces or quotation marks. Add optional config parameters the same way if Firebase provided them. If a value contains URL-reserved characters, percent-encode it; `URLSearchParams` does this automatically when constructing a query string. The app also uses `URLSearchParams` to encode settings in the email sign-in return URL.

You can also paste the Firebase values into the form that appears when you open the plain GitHub Pages URL without the required parameters. The form asks for project ID, API key, auth domain, and app ID; optional fields are under “Optional Firebase settings.” On submit, the config stays in memory and is not saved to local storage or a JavaScript source file.

**Privacy note:** Firebase web configuration and its API key identify a project; they are not passwords and Firebase expects browser apps to use them. However, URL parameters are visible in the address bar, browser history, and may be copied/shared. Never put service-account credentials, private keys, passwords, or other secrets in the URL. Protect data with Firestore Security Rules.

### 3. Create the Firestore database and secure its rules

1. In the Firebase console, make sure the **church-library-test** project is selected. Open **Build** → **Firestore Database** → **Create database**.
2. Choose a location near the church's users. The database location cannot easily be changed later. Choose **Start in production mode**, then create the database.
3. Open the **Rules** tab. In the website folder, open `firestore.rules`, copy its entire contents, replace the starter rules in the console, and click **Publish**. This step matters: do not leave test-mode/open rules in place.
4. If the console reports a rules syntax error, do not proceed to launch. Copy the error and exact rule line for troubleshooting. Repeat database creation and rules publication separately in the `churchlibrarygbcma` project when setting that church up.

### 4. Turn on passwordless sign-in

1. In the same project, open **Build** → **Authentication** → **Get started**.
2. Under **Sign-in method** (sometimes shown as **Providers**), enable **Google**. Pick the project's support email and save.
3. Enable **Email/Password**, then enable its **Email link (passwordless sign-in)** option. Save.
4. In Authentication → **Settings** → **Authorized domains**, add the GitHub Pages hostname (for example, `YOUR-GITHUB-NAME.github.io`; no scheme or repository path). Firebase's `firebaseapp.com` auth domain belongs in the web app config's `authDomain` parameter; it is not the site's GitHub Pages hostname.
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

The document's fields are `name` (string) and `theme` (map). Inside the map, create `primary`, `accent`, `background`, `surface`, and `text` as strings like `#315b4b`. This public document lets the app show the church's name and colors after it connects to the project.

### 6. Publish the website with GitHub Pages

GitHub Pages serves the static app for free over HTTPS; this project does not require Node.js or Firebase CLI to publish it.

1. Put the website files (`index.html`, `app.js`, `styles.css`, `firestore.rules`, and the documentation) in the root of your GitHub repository. The app no longer needs `firebase-config.js`; do not add Firebase config to a JS file.
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**. Choose the branch that contains the files (commonly `main`) and folder `/ (root)`, then click **Save**.
4. Wait for GitHub Pages to publish. Its URL will look like `https://YOUR-GITHUB-NAME.github.io/freechurchlibrary/`. In Firebase Authentication → **Settings** → **Authorized domains**, add `YOUR-GITHUB-NAME.github.io` (hostname only, without scheme or repository path).
5. Open your site's URL with the Firebase query parameters from **Build the GitHub Pages URL** above. For example: `https://YOUR-GITHUB-NAME.github.io/freechurchlibrary/?apiKey=YOUR_API_KEY&authDomain=church-library-test.firebaseapp.com&projectId=church-library-test&appId=YOUR_APP_ID`.

To publish Firestore rules without Firebase CLI, open Firebase console → the correct project → **Firestore Database** → **Rules**, paste the contents of `firestore.rules`, and click **Publish**. Repeat in each separate Firebase project. The file `firebase.json` is for Firebase Hosting/CLI and is not required by GitHub Pages.

### 7. Make your account the first administrator

1. Open the configured GitHub Pages URL from step 6 and sign in with your Google account. The first time, the app will say your account is waiting for approval; that is expected.
2. In Firebase console, make sure the **church-library-test** project is selected. Open **Build** → **Authentication** → **Users**. Find the user matching the Google account you just used, then copy the **User UID** exactly.
3. Open **Firestore Database** → **Data**. Create collection `admins` if it does not exist. Add a document whose document ID is the exact UID from Authentication. Add string fields `displayName` (your name) and `email` (your sign-in email), for example:

   ```json
   {
     "displayName": "Your Name",
     "email": "admin@example.org"
   }
   ```

4. Reload the configured website URL. Signing in with that account should now open the **Library administration** page. The admin document must be entered in the console/trusted tooling: browser clients are deliberately forbidden from granting themselves admin status.

Do this separately in each church project. An admin UID from the test project's Authentication users will **not** identify the same person in the other project's Auth database; sign in once to that project and use its UID.

5. Add a test book from **Catalog**. Sign out and try a separate account to verify it remains pending until approved. Remove test books/data before inviting members.

### Repeat for the second church

Repeat Firebase steps 1–5 and 7 for `churchlibrarygbcma`. Select that project in the console before editing its Firestore data, Auth users/providers, or rules. Use that project's own config values in its URL; the `projectId` selects which church library the app connects to.

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

GitHub Pages is the recommended preview for this project because it serves the site over HTTPS. Opening `index.html` by double-clicking it (`file://`) is not supported; Firebase Auth and browser modules need an HTTP(S) origin.
