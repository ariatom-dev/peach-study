# Peach Study — starter app

A free, local-first React study app. Paste one term and definition per line to create a study set. Tap a card to reveal the definition.

## Run it on Windows

1. Install Node.js LTS from https://nodejs.org if you do not already have it.
2. Extract this ZIP to a folder you can find, such as `Documents\PeachStudy`.
3. Open PowerShell in that folder.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open the local URL Vite prints (usually `http://localhost:5173`).

## Import format

One entry per line, in any of these formats:

```text
Diffusion: Movement of particles from higher to lower concentration.
Osmosis | Movement of water across a selectively permeable membrane.
Active transport — Movement across a membrane using energy.
```

Lines without a separator are ignored. Your study sets are saved in this browser on this device. Use **Export backup** to download a JSON backup.

## Current limits

- This is the first working prototype, not yet deployed or installed on iPhone.
- Local browser data does not automatically sync between devices.
- The first version uses no AI and makes no paid API calls.
- Next milestone: improve import format and prepare PWA hosting/install instructions for iPhone.


## iPhone Home Screen preparation

This project now includes a web app manifest, app icons, Apple Home Screen metadata, and a basic service worker. To install it on an iPhone, it must first be deployed to an HTTPS address. In Safari on iPhone, open that address, tap Share, then choose **Add to Home Screen**. The app is not deployed by this ZIP itself.
