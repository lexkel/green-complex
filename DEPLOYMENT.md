# Deployment Guide - Green Complex

This guide covers deploying the Green Complex putting stats app to Vercel.

## Prerequisites

- GitHub account with repository: https://github.com/lexkel/green-complex.git
- Vercel account (sign up at https://vercel.com)
- Code pushed to GitHub

## Environment Variables

The app requires the following environment variable for authentication:

### `NEXT_PUBLIC_AUTH_USERS`

**Format:** `"username1:passcode1,username2:passcode2"`

**Example:** `"alex:1234,sarah:5678"`

**Description:** Comma-separated list of username:passcode pairs for authentication.

## Deployment Steps

### 1. Push Code to GitHub

If you haven't already:

```bash
git add .
git commit -m "Fix: Use environment variables for auth config"
git push origin main
```

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import your GitHub repository: `lexkel/green-complex`
3. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
4. Add environment variables:
   - Click "Environment Variables"
   - Add variable:
     - **Name:** `NEXT_PUBLIC_AUTH_USERS`
     - **Value:** Your user credentials (e.g., `alex:1234,sarah:5678`)
     - **Environments:** Production, Preview, Development (check all)
5. Click "Deploy"

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally (if not already installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name? green-complex
# - Directory? ./
# - Override settings? No

# Add environment variable
vercel env add NEXT_PUBLIC_AUTH_USERS

# When prompted, enter your user credentials:
# alex:1234,sarah:5678

# Select all environments (Production, Preview, Development)

# Deploy to production
vercel --prod
```

### 3. Verify Deployment

1. Visit your Vercel deployment URL (e.g., `https://green-complex.vercel.app`)
2. Test authentication with your configured credentials
3. Start a round and verify data persists
4. Check that all features work (stats, course switching, etc.)

## Post-Deployment

### Custom Domain (Optional)

1. Go to your project settings on Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Environment Variable Updates

To update user credentials after deployment:

**Via Dashboard:**
1. Go to your project on Vercel
2. Settings → Environment Variables
3. Edit `NEXT_PUBLIC_AUTH_USERS`
4. Save and redeploy

**Via CLI:**
```bash
vercel env rm NEXT_PUBLIC_AUTH_USERS production
vercel env add NEXT_PUBLIC_AUTH_USERS production
# Enter new value when prompted
vercel --prod
```

## Troubleshooting

### Build Fails with "Module not found: '@/config'"

**Solution:** Ensure you're using the latest version of `GoogleAuth.tsx` that uses environment variables instead of the config file.

### Authentication Not Working

**Possible causes:**
1. `NEXT_PUBLIC_AUTH_USERS` not set in Vercel
2. Incorrect format (must be `username:passcode,username2:passcode2`)
3. Spaces in credentials (trim them)

**Check:**
```bash
# View environment variables
vercel env ls
```

### Data Not Persisting

**Cause:** The app uses localStorage, which is browser-specific and device-specific.

**Expected behavior:** Data is stored locally on each device. To sync across devices, you'll need to implement cloud storage (future enhancement).

## Architecture Notes

### Current Implementation

- **Frontend:** Next.js 16 with React 19
- **Styling:** Custom CSS with Tailwind utilities
- **Storage:** Browser localStorage (no backend)
- **Auth:** Simple username/passcode stored in environment variables
- **Deployment:** Static site generation (SSG) + client-side rendering

### Limitations

- No data sync across devices (localStorage only)
- No backend/database (all data stored locally)
- Simple auth (no password hashing, no account recovery)
- No multi-user data sharing

### Future Enhancements

Consider these improvements for production use:

1. **Backend + Database:**
   - Add Supabase, Firebase, or PostgreSQL
   - Store rounds, courses, user data in database
   - Enable cross-device sync

2. **Better Authentication:**
   - Use NextAuth.js with OAuth providers
   - Add password hashing (bcrypt)
   - Implement account recovery

3. **Cloud Storage:**
   - Export rounds to Google Sheets (code exists, currently disabled)
   - Store course data in database
   - Enable data import/export

4. **PWA Improvements:**
   - Offline support
   - Push notifications
   - App install prompts

## Support

For issues or questions:
- GitHub Issues: https://github.com/lexkel/green-complex/issues
- Check Next.js docs: https://nextjs.org/docs
- Check Vercel docs: https://vercel.com/docs

## Security Note

**IMPORTANT:** The current authentication system is simple and NOT production-grade:
- Credentials stored in plain text in environment variables
- No password hashing
- No rate limiting
- No session management

For a production app with sensitive data, implement proper authentication using:
- NextAuth.js
- Encrypted credentials
- Session tokens
- Rate limiting
- HTTPS only (Vercel provides this by default)
