# Install Edwin's Manager

The admin system is an installable Progressive Web App (PWA). It opens in its own app window, has a desktop or Home Screen icon, and connects to the same database as the dealership website. It is not an offline database or a separate copy of the inventory.

## On this Windows computer

1. Install Node.js 24 or newer and run `npm.cmd install` in the project folder once.
2. Double-click `Start-Admin.cmd`. It starts the local server when needed and opens the admin page. Alternatively use `npm.cmd start` and visit http://127.0.0.1:3000/admin/.
3. Sign in. Choose **Install admin app** in the toolbar or Settings. When the browser offers installation, accept it. If no prompt is available, use Edge's **Apps > Install this site as an app** or Chrome's install option.
4. Launch Edwin's Manager from its new desktop or Start menu shortcut. For a local installation, the Node server still needs to be running. `Start-Admin.cmd` starts it again after a computer restart.

The launcher does not register a Windows service or modify startup settings. The installable app is delivered by the browser, not an `.exe` installer. Edge permits PWA development on localhost without HTTPS; shared deployments require HTTPS. See [Microsoft's PWA guide](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/) and [Edge installation help](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge).

## On an iPad

1. Make the dealership server available at a shared HTTPS address. This can be a private deployment; the public launch does not need to happen first.
2. Open that address followed by `/admin/` in Safari and sign in.
3. Choose **Share > Add to Home Screen**. Enable **Open as Web App** when offered, then tap Add.
4. Open Edwin's Manager using its Home Screen icon.

Apple documents these steps in [Turn a website into an app in Safari on iPad](https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados).

`127.0.0.1` on an iPad refers to the iPad itself, not this Windows computer. An iPad cannot run the project's Node server directly. No shared HTTPS address has been provisioned or deployed yet. Do not expose this preview by forwarding a router port.

## Connected operation

Admin sessions sign out after 15 minutes without interaction, with an additional eight-hour absolute limit. The server enforces inactivity independently of browser timers. Mouse, keyboard, touch, and scroll activity renew the idle timer; background API reads do not.

Sign-in credentials are held only in the current window's memory. Closing, reopening, or reloading the admin window requires signing in again. A normal page close also sends a best-effort logout request. Mobile browsers may omit close events when force-quit, so a cookie alone cannot restore access; unused server sessions expire automatically. See [MDN's pagehide event notes](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event). Unsaved edits are discarded when signed out.

Website visitors and every installed admin app use the same server. Refresh the workspace to retrieve the latest stock, enquiries, and viewings. Saving business settings updates the contact information and homepage tagline used on the public pages when loaded. A vehicle editor detects stale versions to avoid silently overwriting a change from another device.

The app caches only its public offline screen and supporting assets. Customer data, credentials, API responses, downloads, and queued edits are not cached by the service worker. When the server cannot be reached, an offline screen or status message appears. Reconnect before saving; changes are not silently queued. The application does not currently send push notifications or email.

## Owner handover

- Use Settings to set verified business contact details and change the admin password. The new password is stored as a salted hash; changing it signs out all devices. The initial local password file is removed and no longer applies. A saved credential takes precedence over the initial `ADMIN_PASSWORD` environment variable.
- Review seller submissions, create a vehicle draft, verify specifications and photos, then publish it. Drafts and archived listings are excluded from the public catalogue and direct detail API.
- Add notes and follow-up dates to enquiries, schedule viewings, and record completed sales. Sale records update the vehicle to Sold and cancel outstanding viewings for that vehicle. They are records of completed transactions, not payment processing or invoices.
- Download CSV reports and SQLite backups from Settings. Backups contain customer records and the admin password hash; store them privately with access restricted to the owner. The download is a consistent database snapshot and does not require stopping the server.
- This version has one owner account. Separate staff identities and permissions are not implemented.

## Restore a backup

Restoration replaces the current database. Perform it only on the intended installation, with the server stopped and a separate copy of the current `backend/storage` folder retained. Use a verified downloaded SQLite backup as `backend/storage/hub.sqlite` in a fresh storage directory, then restart the server. Never combine an older database with existing `hub.sqlite-wal` or `hub.sqlite-shm` files. Keep the previous storage folder intact until the restored records have been checked. The password stored in that backup becomes the active password after restoration.

For handover, test a restore in a separate installation first. The automated tests verify that downloaded backups open correctly and contain the expected records; they do not overwrite your live data.
