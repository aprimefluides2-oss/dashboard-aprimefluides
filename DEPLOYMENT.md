# Deployment Guide - app-realisations

This guide explains how to deploy the app-realisations application to Vercel.

## Prerequisites

1. GitHub account and repo created for app-realisations
2. Vercel account (free tier is sufficient)
3. API keys for OpenAI and Anthropic
4. CLIENT_PUBLISH_TOKEN from Django backend

## Step 1: Push to GitHub

```bash
cd /home/ubuntu/app-realisations

# If remote not set up yet:
git remote add origin https://github.com/YOUR_USERNAME/app-realisations.git
git branch -M main
git push -u origin main
```

## Step 2: Link Vercel Project

Option A - Via Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Select "Import Git Repository"
4. Choose the app-realisations repo from GitHub
5. Click "Import"

Option B - Via CLI:
```bash
cd /home/ubuntu/app-realisations
npx vercel --prod
```

This will prompt you to:
- Link to Vercel (or create project)
- Confirm settings (should auto-detect as Next.js)

## Step 3: Configure Environment Variables

### Via Vercel Dashboard

1. Go to your project settings: https://vercel.com/dashboard/projects/app-realisations
2. Navigate to "Settings" → "Environment Variables"
3. Add the following variables for **Production**:

```
NEXTAUTH_SECRET=lVyP34V694lLsEwqxIPvrjQntbuPX22EyxZZFgzVVh0=
NEXTAUTH_URL=https://[PROJECT_NAME].vercel.app
AUTH_USER_1=technicien1:$2b$10$qf8VIy.uPuB7jYwaw7l9O.NsR3rcs6.xLnHn0eP7Z8hCZ2eE9l8v2
AUTH_USER_2=technicien2:$2b$10$2YvOz/Dzt2kmzQub7sJM1.Zd0CnL6r58TMzcEcuunak0haLNn2jTu
AUTH_USER_3=technicien3:$2b$10$OOBA3VaDlolM.GF8RxrZuu/tc/363cYESvHAhnzKESgQLEJCK1EmO
OPENAI_API_KEY=sk-[YOUR_OPENAI_KEY]
ANTHROPIC_API_KEY=sk-ant-[YOUR_ANTHROPIC_KEY]
CLIENT_API_URL=https://www.aprime-fluides.fr
CLIENT_PUBLISH_TOKEN=ruiQvAxSn5VL075j9WfTEL7ftvykTXkEgqBvbfFQfsw
```

Replace `[PROJECT_NAME]` with your actual Vercel project name (e.g., app-realisations-ltdb).

### Via CLI

```bash
cd /home/ubuntu/app-realisations

npx vercel env add NEXTAUTH_SECRET production
# Paste: lVyP34V694lLsEwqxIPvrjQntbuPX22EyxZZFgzVVh0=

npx vercel env add NEXTAUTH_URL production
# Paste: https://[PROJECT_NAME].vercel.app

npx vercel env add AUTH_USER_1 production
# Paste: technicien1:$2b$10$qf8VIy.uPuB7jYwaw7l9O.NsR3rcs6.xLnHn0eP7Z8hCZ2eE9l8v2

npx vercel env add AUTH_USER_2 production
# Paste: technicien2:$2b$10$2YvOz/Dzt2kmzQub7sJM1.Zd0CnL6r58TMzcEcuunak0haLNn2jTu

npx vercel env add AUTH_USER_3 production
# Paste: technicien3:$2b$10$OOBA3VaDlolM.GF8RxrZuu/tc/363cYESvHAhnzKESgQLEJCK1EmO

npx vercel env add OPENAI_API_KEY production
# Paste: sk-[YOUR_OPENAI_KEY]

npx vercel env add ANTHROPIC_API_KEY production
# Paste: sk-ant-[YOUR_ANTHROPIC_KEY]

npx vercel env add CLIENT_API_URL production
# Paste: https://www.aprime-fluides.fr

npx vercel env add CLIENT_PUBLISH_TOKEN production
# Paste: ruiQvAxSn5VL075j9WfTEL7ftvykTXkEgqBvbfFQfsw
```

## Step 4: Trigger Deployment

After environment variables are set, Vercel should automatically deploy. You can also:

1. Push a new commit to main branch
2. Or go to Vercel Dashboard and click "Redeploy"

## Step 5: Verify Deployment

Once deployment completes:

1. Open the Vercel URL (e.g., https://app-aprimefluides.vercel.app)
2. Should redirect to `/login` (protected route)
3. Try login with invalid credentials → should show error message
4. Login with valid credentials:
   - Username: `technicien1`, Password: `tech123`
   - Or: `technicien2`, Password: `tech456`
   - Or: `technicien3`, Password: `tech789`
5. Should redirect to `/nouveau` page
6. Test form submission with voice or text input
7. Test PDF generation
8. Test publish functionality

## Test Users

The following test users are pre-configured:

| Username | Password | Hash |
|----------|----------|------|
| technicien1 | tech123 | $2b$10$qf8VIy.uPuB7jYwaw7l9O.NsR3rcs6.xLnHn0eP7Z8hCZ2eE9l8v2 |
| technicien2 | tech456 | $2b$10$2YvOz/Dzt2kmzQub7sJM1.Zd0CnL6r58TMzcEcuunak0haLNn2jTu |
| technicien3 | tech789 | $2b$10$OOBA3VaDlolM.GF8RxrZuu/tc/363cYESvHAhnzKESgQLEJCK1EmO |

## Troubleshooting

### Build fails with "Cannot find module"
- Ensure all dependencies are in package.json
- Run `npm install` locally to verify

### Environment variables not loading
- Verify they're set in Production environment (not Preview)
- Redeploy after adding/updating variables
- Check Variables in Vercel dashboard

### API client not responding
- Verify CLIENT_PUBLISH_TOKEN matches Django settings
- Check CLIENT_API_URL is accessible from Vercel region
- Review server logs for CORS issues

### NextAuth authentication not working
- Ensure NEXTAUTH_SECRET is set
- Verify NEXTAUTH_URL matches actual deployment URL
- Check NextAuth logs in browser console

## Support

For issues, check:
- Vercel build logs: https://vercel.com/dashboard
- Function logs: Vercel Dashboard → Deployments → [latest] → Runtime Logs
- Local testing with `npm run dev`
