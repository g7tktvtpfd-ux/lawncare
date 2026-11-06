[README.md](https://github.com/user-attachments/files/34458490/README.md)
# C&M Neighborhood Services — Website

Version 3 (visible multi-service checkboxes) — a rebuilt version of your November 4 website concept, with the **new green, photo-based homepage** from your screenshot. Includes public services, prices, multi-service job requests, and a **private team dashboard/calendar** for Curtis and Mustafa.

> **Important:** This is a new reconstructed project based on the screenshot and earlier details. It does not contain the exact original website source files, because those were on the other computer. Your old editing code and Outlook credentials were **not** recovered.

## IMPORTANT — changes not showing?

Read `UPDATE_INSTRUCTIONS.txt` first. A ZIP download does NOT automatically update a running server. You must close the old Node.js window, unzip this project, and start the new project. Visit `http://localhost:3000/?v=3` and hard refresh with Ctrl+Shift+R.

## Start on Windows

1. Unzip the folder somewhere permanent, like your Desktop.
2. Install **Node.js 18 or newer** if it isn't already installed.
3. Double-click **START_WEBSITE.bat**, or open a terminal in the website folder and run `npm start`.
4. Open **http://localhost:3000**. This is what customers will see when the site is published.
5. Visit **http://localhost:3000/admin** to see your team dashboard.

**The site works without email or database setup for local testing. Customers can select **several services in one request**, and the dashboard keeps them together.** When a customer presses **Send Request**, their information is saved on the server in `data/requests.json` and appears on your admin page. The customer doesn't need to open an email app.

### Set your own private editing code

For `/admin` to work, open `.env` (START_WEBSITE.bat creates it if missing) and fill in:

```
ADMIN_CODE=choose-your-own-unique-private-code
SESSION_SECRET=a-long-private-random-string
```

Use your own values. The old code is not in this download. **Don't upload `.env` to GitHub or share it.** If you change `.env`, stop and restart your server.

## Edit the homepage

- `public/index.html` — main text, service names, form fields, homepage sections.
- `public/styles.css` — colors, font sizes, cards, spacing, mobile layout.
- `public/app.js` — mobile menu, multi-service picker, and customer form behavior.
- `public/assets/logo-original.png` — your original C&M logo from earlier.
- `public/assets/hero-fallback.jpg` — backup background shown offline. With internet access the page loads a separately credited free Pexels lawn-and-house image. To use your own permanent photo, put it in `public/assets/hero.jpg` and change `.hero-bg:after` background image in CSS to `url('/assets/hero.jpg')`.
- `public/admin.html`, `public/admin.css`, `public/admin.js` — team requests and calendar.
- `server.js` — backend, request storage, private login, optional email.

## What's included

- New homepage matching the reference screenshot's layout, dark green/lime colors, hero section and right-hand form.
- Lawn Mowing **starting at $25**.
- Leaf Cleanup **starting at $30**.
- Car Washing **starting at $20**.
- Garden Weeding **starting at $20**.
- Trash Bin Cleaning **starting at $15**.
- Yard Work **starting at $25**.
- Gutter Cleaning **quote after review** (elevated work must be handled by suitably trained adults).
- Select **multiple jobs/services** at once using the **visible checkbox grid** in the customer form; clicking any service tile toggles that service on or off.
- A direct **Send Request** button; no customer's email app opens.
- `/admin` password-protected team area, status tracking, notes, price, date scheduling, calendar, quick respectful reply template.
- Mobile-friendly design.

The prices are starting prices, not final quotes. There is no real payment or booking confirmation process here.

## Outlook/Hotmail email setup

The website can send job notifications **to an Outlook/Hotmail inbox** and send reply emails through **Resend** (an HTTPS email service). It does **not** need the customer's email application and it does **not** ask for your Outlook password.

1. Create a Resend account and verify a domain you control for sending emails (check their current plan and domain-verification requirements).
2. Set `NOTIFICATION_EMAIL` to the Outlook/Hotmail address where you want job alerts.
3. Set `RESEND_API_KEY` to your private Resend API key.
4. Set `FROM_EMAIL` to an email address on your verified sending domain.
5. Restart the server.

Without these settings, **requests are still saved** and visible on the dashboard, but **automatic notifications and direct email replies aren't enabled**. The **Copy reply** button works without email configuration.

## Publish online for free (setup required)

You can deploy the Node app with Render or another Node-friendly host. Render's free service may sleep when inactive. **A free web server's local disk is often temporary**; do NOT rely on `data/requests.json` for important customer data in public hosting.

### Cloud storage via Supabase

1. Create your own Supabase project.
2. Run `schema.sql` in its SQL editor.
3. On your hosting provider, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as **server environment variables**. Never place the service-role key in an HTML or JavaScript file or post it in chat.
4. Set `ADMIN_CODE` and `SESSION_SECRET` as additional secret environment variables.
5. Publish the GitHub repository to your host (Render build command: leave blank; start command: `npm start`; Node 18+).
6. Test the public request form, the private dashboard and email notifications with a test request before sharing your website link.

This uses only server-side Supabase access; public browsers never see database keys.

### Security/privacy

- Keep the editing code, `.env`, API keys and user request data private.
- Only your team should access `/admin`; don't share the dashboard URL and code with customers.
- Don't upload customer contact details publicly or commit the `data/requests.json` file.
- If you expand beyond a simple neighborhood service, review applicable privacy/consent rules and appropriate access controls.

## Photo credit

Remote hero photo: [Jonathan Cooper / Pexels](https://www.pexels.com/photo/green-lawn-grass-in-the-front-yard-12503553/) (free Pexels photo, subject to Pexels licensing). Original C&M logo: from the user's previous logo image. The offline fallback is derived from the user's supplied homepage screenshot.

## Updated multi-service requests

The form sends a `services` list (one or more values) instead of a single `service` value. The server also accepts the original single-service format, so older clients remain compatible. Requests save the list and a readable combined `service` label; previous requests continue to display in the dashboard. Email alerts and the quick-reply template include every selected service.

Gutter Cleaning is listed **without a fixed starting price** because no price was supplied. Any work at height must be evaluated and performed by appropriately equipped, trained adults.
