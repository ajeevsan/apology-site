# Apology site

Static site (`index.html`, `style.css`, `script.js`) plus one serverless function (`api/respond.js`) that emails you her answer.

## 1. Add the song

"Dooron Dooron" is copyrighted, so I haven't included it. Put an MP3 you legally own at:

```
assets/dooron-dooron.mp3
```

Until you do, the music button shows a short "song file is missing" message and everything else works. Keep the file under ~5 MB so it loads quickly on her phone.

## 2. Set up email (Resend, free tier)

1. Create an account at https://resend.com **using sanjeevmajhi036@gmail.com**. Without a verified domain, Resend only delivers to the email you signed up with, which is exactly your case.
2. Create an API key.
3. In Vercel (next step), add these environment variables:
   - `RESEND_API_KEY` = your key
   - `TO_EMAIL` = sanjeevmajhi036@gmail.com
   - `FROM_EMAIL` (optional) = leave unset to use `onboarding@resend.dev`

The key never appears in the browser code.

## 3. Deploy (Vercel, free)

```
npm i -g vercel
cd apology-site
vercel          # follow the prompts
vercel --prod
```

Add the env variables in the Vercel dashboard (Project → Settings → Environment Variables) or with `vercel env add`, then redeploy. Send her the production link.

## 4. Test before sending it

- Open the live link on your phone, go through every slide, tap YES, send, and confirm the email arrives. Then clear the saved answer: in your browser, remove the site's local storage (or use a private tab) so the site lets you test again.
- Check the music button after adding the MP3.

## How it behaves

- Music never autoplays. It tries to start when she taps "Open My Heart", and otherwise the music button pulses so she can start it herself.
- YES and NO look identical. After choosing, she can add an optional note, change her answer, and then tap "Send my answer". The email goes out at that moment, with the answer, timestamp (IST and UTC) and her note.
- Duplicates: each answer has a unique token, reused on retries, and the server passes it to Resend as an idempotency key. Her browser also remembers she already answered.
- If sending fails, she sees a gentle retry message and nothing is lost.
- Honeypot field and a light rate limit guard against bots.
- The page is `noindex`, so search engines won't list it.
