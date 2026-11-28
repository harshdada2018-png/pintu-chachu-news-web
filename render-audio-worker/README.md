# PublicSpark Render Audio Worker (`WebM / Opus`)

Stateless FFmpeg compression microservice for PublicSpark Newsroom.

## Deploy on Render Free Tier
1. Create **1** Web Service on Render connected to this repository.
2. Set **Root Directory** to `render-audio-worker`.
3. Set **Language / Runtime** to `Docker`.
4. Add Environment Variables:
   - `RENDER_AUDIO_SECRET` = `<same shared random secret set in Cloudflare Pages>`
   - `GEMINI_API_KEY` = `<your Gemini API key>`
   - `GEMINI_TTS_API_KEY` = `<optional dedicated TTS project Gemini key>`
5. Configure an external 11-minute keep-alive ping (`UptimeRobot` / `cron-job.org` / Google Apps Script) to `GET https://<your-service>.onrender.com/health`.

