# Ritesh Karki — Portfolio

A single-page portfolio site (plain HTML/CSS/JS — no build step needed).

## Deploy once, update forever (free, stable URL)

**1. Create the GitHub repo**
- Go to https://github.com/new
- Repo name: `portfolio` (or anything you like)
- Keep it Public, don't add a README (you already have one)
- Click **Create repository**
- On the next page, follow the "…or push an existing repository" instructions, or just drag-and-drop `index.html` and `README.md` into the repo using the **Add file → Upload files** button in GitHub's web UI — no command line needed.

**2. Connect it to Vercel**
- Go to https://vercel.com and sign up/log in with your GitHub account (free)
- Click **Add New → Project**
- Select your `portfolio` repo → click **Import**
- Framework preset: choose **Other** (it's a static HTML site, no build command needed)
- Click **Deploy**

You'll get a URL like `https://portfolio-riteshkarki11.vercel.app` — **this URL never changes**, no matter how many times you update the site. That's the link you put on your resume.

**3. Every future update**
- Whenever you (or I, in a future chat) change `index.html`, upload the new version to the same GitHub repo (overwrite the file, or use `git push` if you're on the command line)
- Vercel watches the repo and automatically redeploys within ~30 seconds
- The URL stays exactly the same — visitors just see the latest version

## Optional: custom domain
If you later want `riteshkarki.com` instead of the `.vercel.app` link, you can buy a domain and attach it in Vercel's project settings → Domains. Not required — the free `.vercel.app` link is permanent and perfectly fine for a resume.

## Notes
- The contact form currently opens the visitor's email app (mailto). To make it deliver silently instead, sign up free at https://formspree.io, create a form, and paste the endpoint into the `FORMSPREE_ENDPOINT` constant near the top of the `<script>` block in `index.html`.
- `Ritesh_Karki_Resume.pdf` is referenced by the "Download Resume" button — add that PDF file to the repo alongside `index.html` so the button works.
