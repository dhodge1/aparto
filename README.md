# Aparto - Tokyo Apartment Listing Notifier

A PWA that monitors housing sites for new rental listings matching your criteria and sends push notifications to your phone.

## Features

- **Hourly polling** of e-housing.jp search results
- **Push notifications** when new listings appear (iOS 16.4+ & Android)
- **Mobile-first dashboard** showing all current listings
- **Favorites** - save listings locally for quick reference
- **Installable PWA** - add to home screen like a native app

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Upstash Redis (data storage)
- Upstash QStash (scheduled polling)
- Web Push API (notifications)
- Vercel (hosting)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Upstash account (free)

1. Go to [upstash.com](https://upstash.com) and create an account
2. Create a **Redis** database (free tier)
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
4. Go to the **QStash** tab in the Upstash dashboard
5. Copy `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

VAPID keys are already generated in `.env.local`. For the Upstash values, paste what you got from step 2.

### 4. Deploy to Vercel

```bash
npx vercel
```

Set all environment variables from `.env.local` in the Vercel dashboard under Settings > Environment Variables.

### 5. Set up hourly polling

In the Upstash QStash dashboard:
1. Create a new schedule
2. **Destination**: `POST https://your-app.vercel.app/api/poll`
3. **Schedule**: `0 * * * *` (every hour)

### 6. Install PWA on phone

1. Open your deployed URL in Safari (iOS) or Chrome (Android)
2. **iOS**: Tap Share > "Add to Home Screen"
3. **Android**: Tap the browser menu > "Install app" or "Add to Home Screen"
4. Open the installed app and tap "Enable Notifications"

## Development

```bash
npm run dev
```

To manually trigger a poll (for testing):

```bash
curl -X POST http://localhost:3000/api/poll
```

## Search Filters

The current search is hardcoded for:
- **Wards**: Minato, Shibuya, Meguro, Setagaya, Shinagawa
- **Price**: ¥0 - ¥260,000/month
- **Size**: 45 - 100+ m²
- **Walking distance**: Up to 12 minutes
- **Features**: Pet-friendly (feature ID 18)

To change filters, edit the `EHOUSING_SEARCH_URL` in `src/lib/ehousing.ts`.
