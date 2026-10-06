# Metro Police Department Desktop App

This folder contains the Windows Electron desktop client for the Metro Police Department website.

## Important

The desktop app does NOT bundle the React website or Express server. It loads the production website from Render:

https://metropd-calirp.com/

This means normal website updates deployed by Render are automatically available in the installed desktop app without rebuilding the installer.

## Local build

From this folder:

```powershell
npm install
npm run dist
```

The Windows installer is created in `release/`.

## GitHub Actions

The repository-root workflow at `.github/workflows/build-desktop.yml` builds the Windows `.exe` whenever the `desktop/` folder changes on `main`, and publishes the installer as a GitHub Release.
