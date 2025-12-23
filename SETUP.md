# Quick Setup Guide

Follow these steps to get the app running:

## 1. Google Cloud Setup (5 minutes)

### Enable APIs
1. Visit https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Go to "APIs & Services" > "Library"
4. Enable these APIs:
   - Google Sheets API
   - Google Drive API

### Create OAuth Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Configure Consent Screen"
   - Choose "External" user type
   - Fill in app name: "Putting Stats Tracker"
   - Add your email as support email
   - Save and continue through the steps
3. Click "Create Credentials" > "OAuth client ID"
4. Select "Web application"
5. Add Authorised JavaScript origins:
   ```
   http://localhost:3000
   ```
6. Add Authorised redirect URIs:
   ```
   http://localhost:3000
   ```
7. Click "Create"
8. **Copy the Client ID** (looks like: `xxx.apps.googleusercontent.com`)

## 2. Configure the App

Create `.env.local` file in the project root:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
```

## 3. Run the App

```bash
npm run dev
```

Open http://localhost:3000

## 4. First Use

1. Click "Sign in with Google"
2. Grant permissions (Sheets and Drive access)
3. Start recording putts!

The app will automatically create a "Putting Stats" spreadsheet in your Google Drive.

## Troubleshooting

### "Configuration Error" message
- Check that `.env.local` exists and contains your Client ID
- Restart the dev server after creating `.env.local`

### "Login failed" or redirect errors
- Verify `http://localhost:3000` is in your OAuth authorised origins
- Check the client ID is correct

### Can't see the spreadsheet
- Check your Google Drive
- The app creates it on first putt record
- Look for "Putting Stats" spreadsheet

### Offline sync not working
- Check browser console for errors
- Verify you granted Google Sheets and Drive permissions
- Try signing out and back in

## Production Deployment

When deploying to production (e.g., Vercel):

1. Add your production URL to Google OAuth settings:
   - Authorised JavaScript origins: `https://your-domain.com`
   - Authorised redirect URIs: `https://your-domain.com`

2. Add the environment variable to your hosting platform

3. Build and deploy:
   ```bash
   npm run build
   ```

## PWA Installation (Mobile)

### Android
1. Open the app in Chrome
2. Tap the three-dot menu
3. Select "Add to Home screen"

### iOS
1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
