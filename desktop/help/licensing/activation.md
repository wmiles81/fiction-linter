---
id: licensing-activation
title: Activation
category: Licensing
order: 1
summary: Enter your license key in the activation screen that appears on first launch. The key is validated against LemonSqueezy and stored securely on your machine.
keywords: activation, license, key, lemonsqueezy, validate, purchase, first launch, register
---

## Activation

When you first launch Fiction Linter Desktop, the **activation screen** appears before the editor opens. It shows the Fiction Linter logo, a **License Key** field, an **Activate** button, and a **Buy a License** button.

### Entering your key

1. Locate your license key in the purchase confirmation email from Ocotillo Quill Press (sent by LemonSqueezy, the payment processor).
2. Click the **License Key** field.
3. Paste your key — it is in the format `XXXX-XXXX-XXXX-XXXX`.
4. Click **Activate** or press **Enter**.

Fiction Linter contacts the LemonSqueezy validation service to confirm the key. This requires an internet connection. If the key is valid, the activation screen closes and the editor opens. If it fails, an error message appears below the key field explaining the problem.

### If you do not have a key yet

Click **Buy a License** to open the purchase page in your browser.

### What happens after activation

Your license key is encrypted and saved in Electron's secure `userData` directory on your machine. You do not need to enter it again on this machine unless you reinstall the OS or explicitly deactivate the license.

The app re-validates the key in the background approximately every 30 days. If you are offline when revalidation is due, see [Offline Use](licensing-offline).

### See also

- [Deactivation](licensing-deactivation)
- [Offline Use](licensing-offline)
