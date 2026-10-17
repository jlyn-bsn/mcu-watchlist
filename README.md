# MCU Watchlist

A single-list MCU watch tracker in plain HTML, CSS and JavaScript. No build step and no account:
watched, archived and reordered titles are saved in the browser (localStorage).

## Run locally

```bash
npx http-server -p 5173 .
```

## Deploy to Firebase Hosting

1. Install the CLI and sign in: `npm install -g firebase-tools` then `firebase login`.
2. Create a project at https://console.firebase.google.com (Hosting needs no database).
3. Link it: `firebase use --add` and pick the project (this writes `.firebaserc`).
4. Deploy: `firebase deploy --only hosting`.

`firebase.json` publishes this folder and leaves out dotfiles, the README and tooling folders.
Progress is per browser and per device; clearing site data removes it.
