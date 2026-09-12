# Edwin's Auto Hub

A responsive car dealership website for Nairobi, with a searchable catalogue, saved cars, vehicle enquiries, seller submissions, and a password-protected admin dashboard.

Repository: https://github.com/PeterNjengaK/edwins-auto-hub

## Run locally

Use Node.js 24 or newer. From this project folder:

```powershell
npm.cmd install
npm.cmd start
```

Open http://127.0.0.1:3000. The admin dashboard is at http://127.0.0.1:3000/admin/.

On first start, a random admin password is saved in `backend/storage/local-admin-password.txt`. Open that local file to sign in. It is excluded from Git. Alternatively, set `ADMIN_PASSWORD` (at least 12 characters) in a root `.env` file before starting the server. `.env.example` documents the supported settings. Restarting the server ends existing admin sessions.

After changing the password in Settings, the stored password hash becomes authoritative and the initial password file is removed. The original environment password no longer signs in. See `INSTALL.md` for handover and backup recovery details.

If port 3000 is busy, set `PORT=3001` in `.env`. The server binds to `127.0.0.1` by default, keeping the preview on this computer. Use `npm.cmd run dev` for automatic backend restarts while editing.

The website and API are served together. Use the Node server, not Live Server or direct HTML-file opening. Existing URLs such as `/cars/`, `/sell/`, and `/cars/car-details.html?id=...` are handled by the server and share `index.html`.

## Multi-category catalogue

One inventory, enquiry inbox, customer list, viewing calendar and sales report now cover:

- **Cars:** new and used, including locally used and foreign used vehicles, with the existing vehicle specifications and filters.
- **Car parts:** new/used condition, SKU or part number, brand, part type, compatibility, location, unit price and stock quantity.
- **Land and plots:** location, area, area unit, property type, tenure and asking price.
- **Houses:** new/used condition, house type, bedrooms, bathrooms, floor area, location, tenure and asking price.

Browse `/cars/`, `/parts/`, `/properties/`, or `/catalogue/`. Saved listings work across all categories. Seller submissions use category-specific fields and remain private until an admin reviews and publishes a draft.

In the admin workspace, choose **Add listing**, then a category. Existing listings keep their category to protect linked history. Parts sale prices are the **total transaction amount**, not the unit price; enter the quantity sold separately. Sales deduct stock, reject overselling and only mark a part sold when its quantity reaches zero. Edit a parts listing to restock it and set its availability. Cars and properties are single-unit sales. Recorded sales cannot be deleted, and sold cars/properties cannot be reopened. Outstanding viewings are cancelled when a listing sells out.

The legacy SQLite `cars` table and admin write URLs remain for compatibility; records without a category are cars. Public `/api/cars` remains vehicle-only, while `/api/listings` covers all published categories. No destructive database migration is required.

## What works

- Search and filter cars by make, body type, budget, year, fuel, transmission, and availability.
- Sort by price, year, mileage, or featured status; filters are preserved in the URL.
- Save favourites in the browser and revisit them after a reload.
- View vehicle specifications, photos, equipment, and enquiry options.
- Submit vehicle enquiries, general messages, and seller details with up to four photos.
- Sign in to add, edit, feature, reserve, mark sold, or delete vehicles.
- Review enquiries, contact customers, and update their progress.
- Manage private notes, priorities, follow-up dates, customer relationships, and linked viewings.
- Convert seller submissions to private drafts; publish or archive listings after review.
- Record completed sales, automatically update stock, and see sales and enquiry reports.
- Update public business details, change the owner password, and download CSV reports or database backups.
- Install the admin PWA on a desktop or iPad. See [installation and handover instructions](INSTALL.md).

## Data and preview content

Inventory and enquiries persist in `backend/storage/hub.sqlite`. Keep the entire storage directory private and backed up. Stop the server before making a filesystem backup so SQLite's database and journal files stay consistent. Never commit storage, credentials, or customer information.

The first development startup seeds six clearly labelled sample vehicles and six sample parts/property listings. All sample photos, prices, and specifications are illustrative, not actual stock or verified offers. New admin listings are real inventory entries and require appropriate photos. Set `SEED_DEMO=false` before first startup to start empty; this does not erase an existing database. Production startup does not seed sample inventory. An existing local preview can opt into the additional samples with `node tools/add-catalogue-samples.cjs`; this adds missing sample IDs without changing existing inventory or enquiries. Do not run that command on live customer data.

Enquiries are saved in the admin inbox. They do **not** send email or WhatsApp notifications. The WhatsApp and phone links open the visitor's own app; they do not send messages automatically. Contact details are retained from the original project and must be confirmed before launch.

The original `data/cars.json` and `backend/cars.json` are retained as historical data files and are not used by the application. The original in-memory API and duplicate page scripts have been replaced.

## Project layout

| Path                                   | Purpose                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `index.html`, `script.js`, `style.css` | Public site and responsive page views                      |
| `shared.js`                            | Formatting, safe text rendering, API and upload helpers    |
| `admin/`                               | Sign-in, inventory editor, and enquiry inbox               |
| `backend/app.js`                       | Express API, SQLite storage, authentication and validation |
| `backend/server.js`                    | Environment loading and local server startup               |
| `backend/seed.js`                      | Illustrative development inventory                         |
| `images/`                              | Locally stored preview photography                         |
| `tests/browser.cjs`                    | Isolated end-to-end browser checks                         |

Dependencies are installed from the root. The backend package file remains compatible with the original setup, but the root install is required for the icon assets and tests.

## Verification

```powershell
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:browser
```

API tests cover authentication, CSRF protection, validation, immutable IDs and categories, preserved photos, enquiry privacy, CRUD, session expiry, database persistence, seller conversions, parts quantities, oversell protection and property sales. Browser tests exercise every category, search, sorting, saved listings, enquiries, seller submissions, admin publishing and creation, sale recording, and responsive layouts. Screenshots are saved under the ignored `test-results/` directory. Tests use isolated temporary databases and do not touch your local inventory or inbox.

Use `npm.cmd run format` to format maintained source files.

## Before public launch

Replace the sample catalogue with actual stock and verified photos, prices, and specifications. Confirm business contact details, viewing arrangements, and all business copy. Finalise the privacy notice, customer-data retention, and a deletion workflow. Decide whether enquiry notifications should use email or another service.

Deploy the Node service with persistent storage, backups, HTTPS, and a strong `ADMIN_PASSWORD`. Set `NODE_ENV=production`; production cookies require HTTPS. The current setup is designed for one Node process. A multi-instance deployment needs shared sessions, shared rate limits, and a shared database. Configure trusted reverse-proxy handling for the chosen host before deployment; it is intentionally not enabled in the local preview. For a larger catalogue, move image uploads from database data URLs to managed object storage and add server-side catalogue pagination.

There are no payments or checkout flows. Sale entries are records of completed transactions. This project has not been deployed. Installed apps still require the dealership server; an iPad needs a shared HTTPS address. See `INSTALL.md` for installation, password rotation, backups, and restoration.

## Photography

Preview images are downloaded from Unsplash image URLs and stored locally, so browsing does not depend on a third-party image service. Sources are listed in `images/SOURCES.md`. They illustrate the preview only; use photos of the actual vehicles for live listings.
