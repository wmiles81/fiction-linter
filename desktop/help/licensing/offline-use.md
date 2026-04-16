---
id: licensing-offline
title: Offline Use
category: Licensing
order: 3
summary: Fiction Linter works fully offline for up to 30 days after the last successful validation. When you reconnect, the app re-validates automatically in the background.
keywords: offline, grace period, 30 days, revalidation, internet, airplane, no connection, reconnect
---

## Offline Use

Fiction Linter does not require a constant internet connection. Once your license is activated, the app runs entirely offline — including the deterministic SPE linter, all file operations, and the editor itself. The only features that require a connection are **AI Scan** and **Fix Now** (which call your AI provider's API).

### The 30-day grace window

The app re-validates your license key approximately every 30 days. If the last successful validation was less than 30 days ago, the app opens normally with no network required.

If more than 30 days have passed since the last validation and the app cannot reach the LemonSqueezy servers, Fiction Linter still opens and lets you work. The grace window prevents travel, airline mode, or temporary network outages from blocking access to your writing.

### Re-validation on reconnect

When you next launch the app with an internet connection, re-validation happens automatically in the background. You will not see any prompt or interruption — the app simply updates the stored validation timestamp silently.

### What happens if the grace window expires

If the app cannot validate your license for an extended period (beyond the grace window), it will show the activation screen and ask you to validate before continuing. Entering your key while online will restore access immediately.

### Writing on a plane

If you plan to write in airplane mode for an extended trip, ensure the app has validated recently before you leave. As long as validation happened within the last 30 days, you have nothing to worry about.

### See also

- [Activation](licensing-activation)
- [Deactivation](licensing-deactivation)
