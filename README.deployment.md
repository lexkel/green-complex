# Green Complex - Deployment Guide

## Environment Setup

This app uses simple authentication. Before deploying, you need to:

1. Copy `config.template.ts` to `config.ts`
2. Update with your username and passcode
3. **IMPORTANT**: `config.ts` is git-ignored for security

## Deployment to Vercel

### Prerequisites
- GitHub account
- Vercel account (free)

### Steps

1. Push code to GitHub
2. Go to vercel.com
3. Import your repository
4. Add environment variables (if needed)
5. Deploy!

### Post-Deployment

After deployment, you'll need to:
1. Create your `config.ts` file on your local machine (never commit this!)
2. Users will authenticate with username/passcode you set

## Current Architecture

- **Storage**: localStorage (client-side only)
- **Auth**: Simple username/passcode (client-side)
- **Backend**: None - fully static Next.js app

## Future Improvements

Consider adding:
- Database backend (Firebase, Supabase)
- Proper authentication (NextAuth.js)
- Cloud sync across devices
