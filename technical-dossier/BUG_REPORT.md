# Bug Report: "Black Screen" & SES Error

## Symptoms

- **User Description**: "Black screen continues, I see NOTHING".
- **Console Error**: `lockdown-install.js:1 SES Removing unperm`
- **Behavior**: The application fails to render any UI. The root `div` remains empty or the app crashes before mounting.

## Environment

- **OS**: Windows
- **Browser**: User's local browser (Chrome/Edge likely)
- **Tech Stack**: React, Vite, Tailwind, Supabase

## Investigation

### Static Analysis
- **Codebase Search**: No instances of "lockdown", "SES", or "agoric" found in `src/`.
- **Dependency Tree**: `npm list` does not show explicit `ses`, `lockdown`, or `endo` packages.
- **Entry Points**: `index.html` and `main.jsx` appear standard.

### Hypotheses

1.  **Browser Extension Conflict**: The error message `SES Removing unperm` is characteristic of Agoric's SES (Secure ECMAScript) shim, often used by Web3 wallets (e.g., MetaMask, Keplr) or security tools. If the user has such extensions installed, they might be injecting `lockdown.js` into the page, which conflicts with the application's code (possibly due to strict mode or specific API usage).

2.  **Hidden Dependency**: A package in `node_modules` might be polyfilling or shimming the environment defensively.
    - *Candidate*: `decimal.js` (unlikely to cause this, but used in finance).
    - *Candidate*: `@supabase/supabase-js` (unlikely).

3.  **Environment Poisoning**: Some global bit of code is "locking down" the Javascript environment (freezing prototypes), and a library used by the app attempts to modify a frozen prototype, causing a crash.

## Recommended specific diagnostics for OpenCode

1.  **Incognito Mode**: Request the user to run the app in Incognito mode to rule out extensions.
2.  **Hardened JS Check**: Check if `window.lockdown` or `window.SES` is defined in the console.
3.  **Stack Trace**: Expand the console error to see the initiator of `lockdown-install.js`.
