# iPhone Shortcut → Money Tracker → local OCR (no image upload)

## Why this handoff

Money Tracker is an offline-first browser PWA. Its normal `SlipScanner` recognizes K PLUS slips, 7-Eleven/7Delivery receipts and Paotang G-Wallet photos **on the device**. The iPhone API `/api/iphone/upload` runs a separate, server-side Tesseract worker and is not used by the workflow below.

Safari on iOS 27 does not implement the Web Share Target API for receiving files in an installed PWA. Passing an image through a regular `Open URL` action is not equivalent to a multipart image handoff. To avoid uploading or persisting the slip on a server, use the iOS clipboard.

## Configure the Shortcut

1. In Shortcuts, edit **Money Tracker** or create a new Shortcut with **Receive Images from Share Sheet** / **Select Photos**.
2. Set the shortcut's input to the image selected in Photos, or use `Shortcut Input` from the share sheet.
3. Optionally **Convert Image** to PNG or JPEG for predictable clipboard compatibility.
4. Add **Copy to Clipboard** with the image as its input. If the action exposes **Local Only** and **Expire At**, keep the data local and set a short expiration. Otherwise manually overwrite the clipboard afterwards.
5. Open **Money Tracker from its Home Screen icon**, not necessarily via Shortcuts' **Open URLs**. `Open URLs` can open Safari instead of the installed PWA, and on iOS the installed PWA and Safari may have **separate local IndexedDB stores**.
6. Tap **อัปโหลดสลิป** → **นำเข้ารูปจาก Shortcut**. Approve the iOS paste prompt if shown. That user tap is necessary for Safari's clipboard permission.
7. The app runs exactly the same in-browser OCR, recovery, validation, deduplication and auto-save as a normal photo upload. Valid records save to the **current app container's IndexedDB**. Incomplete or conflicting records are not saved silently.

Do **not** configure a `Get Contents of URL` upload, API token, `multipart/form-data`, or the server OCR endpoint for this workflow.

## Limits / privacy

- Browser reads `image/png`, `image/jpeg` and `image/webp` from the clipboard, up to 20 images where the clipboard API exposes multiple items. Most iPhone clipboards expose only one copied image at a time.
- Image bytes remain transient in memory during OCR and are never POSTed to Money Tracker API or written to permanent image storage.
- SHA-256 of the image may be stored with a validated transaction to detect reimports. Only extracted financial fields and optional receipt itemization are saved.
- Clipboard data itself remains in **iOS** until overwritten or expired, independent of the Money Tracker app.
- Safari can deny programmatic paste without user interaction. If so, tap the import button again and allow the paste prompt; the standard Photos picker is the fallback.
- A fully unattended Shortcut → closed PWA → local OCR is **not possible with these browser APIs**. It would require a native iOS share extension or a short-lived encrypted server handoff with explicit retention rules.
- Verify on a real device in the exact browsing context where Money Tracker data is stored.
