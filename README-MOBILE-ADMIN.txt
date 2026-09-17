NISHI & MANU - MOBILE INVITATION ADMIN

WHAT THIS DOES
==============

You can manage invitations directly from your phone at:

https://YOUR-DOMAIN/admin-generator

You enter an admin password, type or paste guest names, and tap
"Generate Invitations".

The page:
- creates random invitation codes
- stores the guest list securely in Netlify Blobs
- immediately shows the personal link
- lets you Copy or Share each link
- lets you export guest-links.csv
- keeps existing guests' links unchanged
- lets you delete an invitation if needed

The public wedding page continues to use:

https://YOUR-DOMAIN/invite/RANDOM_CODE


ONE-TIME NETLIFY SETUP
======================

1. Deploy this entire project to Netlify.

The project must include:

index.html
admin.html
_redirects
package.json
netlify.toml
netlify/functions/invitation.js
netlify/functions/admin-invitations.js

2. In Netlify, add this environment variable:

INVITE_ADMIN_SECRET

Set the value to a strong password that only you know.

Example:

INVITE_ADMIN_SECRET = YourLongPrivatePasswordHere

Do NOT put that password inside index.html or admin.html.

3. Redeploy the site after adding the environment variable.

4. Open:

https://YOUR-DOMAIN/admin-generator

Enter the password and create your invitations.


HOW IT WORKS
============

ADMIN PAGE
----------
Your phone sends the guest name and your admin password to the protected
Netlify Function.

The password is checked against the INVITE_ADMIN_SECRET environment variable.

The password is never hard-coded into the website.

GUEST STORAGE
-------------
Guest names and codes are stored in a private Netlify Blobs store named:

wedding-invitations

The browser never receives the complete guest registry unless you are logged
into the admin page with the correct admin password.

PUBLIC INVITATION
-----------------
When a guest opens:

/invite/ABC123...

index.html asks the public invitation function to look up only that code.

If the code exists, the function returns only the matching name.

If the code is invalid, the existing website displays Invalid Invitation.

PERSISTENCE
-----------
Netlify Blobs is site-wide storage, so your generated invitations survive new
deployments. You do not need to regenerate invitations or edit a JSON file
when you update the website later.


IMPORTANT DEPLOYMENT NOTE
=========================

This version uses the @netlify/blobs npm package.

For the easiest setup, deploy with a Git-connected Netlify project so Netlify
installs package.json dependencies automatically.

If using Netlify CLI for a manual deployment, run:

npm install

before:

netlify deploy --prod


PHONE WORKFLOW
==============

1. Open /admin-generator
2. Enter your admin password
3. Type one guest name or paste many names, one per line
4. Tap Generate Invitations
5. Tap Copy Link or Share
6. Send it through WhatsApp, Messenger, Messages, email, etc.

No PC, Node generator, CSV editing, or redeployment is required when adding a
new guest.


SECURITY
========

The admin page itself is public, but it cannot read or change the guest list
without the correct INVITE_ADMIN_SECRET.

Use a long unique password.

The password is kept in sessionStorage on the device, meaning the page can
remember it during that browser session without writing it into your website
files.

This is suitable for a private wedding invitation manager. It is not intended
to replace a full multi-user authentication system.
