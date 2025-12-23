# Golf Putting Stats Tracker

A Progressive Web App for tracking golf putting statistics with Google Sheets integration.

## Features

- Quick putt entry form optimised for on-course use
- Google Sheets backend for data storage
- Offline support with automatic syncing
- Statistics dashboard with make percentages by distance
- PWA - installable on mobile devices
- Works in both metres and feet
- UK English throughout

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 3. Create OAuth 2.0 Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen if prompted
4. Choose "Web application" as the application type
5. Add authorised JavaScript origins:
   - `http://localhost:3000` (for development)
   - Your production URL (when deployed)
6. Add authorised redirect URIs:
   - `http://localhost:3000` (for development)
   - Your production URL (when deployed)
7. Copy the Client ID

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Google Client ID:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 5. Add App Icons

Create two PNG icons and place them in the `public` folder:
- `icon-192x192.png` (192x192 pixels)
- `icon-512x512.png` (512x512 pixels)

Use a golf/putting-related image or logo.

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Build for Production

```bash
npm run build
npm start
```

## How It Works

### Data Storage

All putting data is stored in a Google Sheet in your Google Drive:
- Sheet name: "Putting Stats"
- Columns: Timestamp, Distance, Made, Conditions, Course, Notes

The app will automatically create this spreadsheet on first use.

### Offline Support

The app uses localStorage to queue putts when offline. When you regain connectivity, queued putts are automatically synced to Google Sheets.

### PWA Installation

On mobile devices, you can install the app to your home screen:
- **Android**: Tap the menu button and select "Add to Home screen"
- **iOS**: Tap the Share button and select "Add to Home Screen"

## Usage

### Recording a Putt

1. Sign in with your Google account
2. Select the distance (use presets or enter custom)
3. Choose metres or feet
4. Tap Made or Missed
5. Optionally add conditions, course, or notes
6. Tap "Record Putt"

### Viewing Statistics

Switch to the Statistics tab to view:
- Total putts and make percentage
- Make percentage by distance range
- Recent session history

## Technology Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Google Sheets API** - Data storage
- **@react-oauth/google** - Authentication
- **next-pwa** - Progressive Web App functionality

## Development

The project structure:

```
/app                 # Next.js app directory
  /page.tsx         # Main application page
  /layout.tsx       # Root layout with auth provider
  /globals.css      # Global styles
/components         # React components
  /GoogleAuth.tsx   # Authentication provider
  /PuttEntry.tsx    # Putt entry form
  /StatsDisplay.tsx # Statistics dashboard
/lib                # Utility libraries
  /googleSheets.ts  # Google Sheets API service
  /offlineStorage.ts # Local storage for offline support
  /statsCalculator.ts # Statistics calculations
/types              # TypeScript type definitions
/public             # Static assets and PWA manifest
```

## Deployment

The app can be deployed to any platform that supports Next.js:

- **Vercel** (recommended): `vercel deploy`
- **Netlify**: Configure for Next.js
- **Self-hosted**: Use `npm run build` and `npm start`

Remember to update your Google OAuth settings with the production URL.

## Licence

MIT
