# Setup & Reproduction Guide

## Prerequisites

- Node.js (v18+ recommended)
- `npm` or `yarn`

## Installation

```bash
git clone <repository-url>
cd portfolio-tracker
npm install
```

## Running the Application (Dev Mode)

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Reproducing the Bug

1.  Open the application in a browser (Chrome/Edge preferably).
2.  Observe the empty page (White/Black screen).
3.  Open Developer Tools (F12) -> Console.
4.  Look for the error: `lockdown-install.js:1 SES Removing unperm`.

## Notes

- The bug appears to be environment-dependent.

- If the bug does NOT reproduce:
    - Try installing Agoric-related browser extensions (e.g. Keplr, MetaMask) to simulate the user's environment.
    - Check if any global polyfills are active.

### Automated Testing Note
- Automated browser testing (e.g., Playwright) may fail in this environment due to missing `$HOME` variable. Manual verification is recommended.

