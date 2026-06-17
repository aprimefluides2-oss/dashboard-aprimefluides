# Deployment Checklist

## Pre-Deployment Verification

- [ ] Git repository has all commits
  ```bash
  git log --oneline | head -5
  ```

- [ ] Build succeeds locally
  ```bash
  npm run build
  ```

- [ ] .env.local.example exists with template
  - [ ] NEXTAUTH_SECRET placeholder present
  - [ ] All AUTH_USER_1..3 with bcrypt hashes
  - [ ] CLIENT_PUBLISH_TOKEN pre-filled
  - [ ] API key placeholders

- [ ] API routes all present
  - [ ] /api/transcribe/route.ts (OpenAI Whisper)
  - [ ] /api/generate/route.ts (Claude)
  - [ ] /api/publish/route.ts (Django proxy)
  - [ ] /api/auth/[...nextauth]/route.ts (NextAuth)

- [ ] Authentication configured
  - [ ] /lib/auth.ts reads AUTH_USER_* env vars
  - [ ] middleware.ts redirects unauthenticated to /login
  - [ ] NextAuth pages point to /login

- [ ] Pages ready
  - [ ] /login page exists
  - [ ] /nouveau page exists with form
  - [ ] / (root) redirects appropriately

- [ ] Configuration files
  - [ ] package.json has all dependencies
  - [ ] vercel.json configured
  - [ ] tsconfig.json for TypeScript
  - [ ] next.config.mjs configured

## Deployment Steps

### Step 1: GitHub Push
- [ ] Create private GitHub repo: `app-realisations`
- [ ] Add remote: `git remote add origin https://github.com/USER/app-realisations.git`
- [ ] Push to main: `git push -u origin main`
- [ ] Verify repo is private and accessible

### Step 2: Vercel Project Creation
- [ ] Go to https://vercel.com/dashboard
- [ ] Click "Add New" → "Project"
- [ ] Select "Import Git Repository"
- [ ] Choose `app-realisations` from GitHub
- [ ] Click "Import"
- [ ] Wait for auto-detection (should show Next.js)

### Step 3: Environment Variables Setup

Set these in Vercel Dashboard > Settings > Environment Variables (Production):

Required (secrets):
- [ ] NEXTAUTH_SECRET = `lVyP34V694lLsEwqxIPvrjQntbuPX22EyxZZFgzVVh0=`
- [ ] OPENAI_API_KEY = `sk-...` (your actual key)
- [ ] ANTHROPIC_API_KEY = `sk-ant-...` (your actual key)

Auth users:
- [ ] AUTH_USER_1 = `technicien1:$2b$10$qf8VIy.uPuB7jYwaw7l9O.NsR3rcs6.xLnHn0eP7Z8hCZ2eE9l8v2`
- [ ] AUTH_USER_2 = `technicien2:$2b$10$2YvOz/Dzt2kmzQub7sJM1.Zd0CnL6r58TMzcEcuunak0haLNn2jTu`
- [ ] AUTH_USER_3 = `technicien3:$2b$10$OOBA3VaDlolM.GF8RxrZuu/tc/363cYESvHAhnzKESgQLEJCK1EmO`

API integration:
- [ ] CLIENT_API_URL = `https://www.aprime-fluide.fr`
- [ ] CLIENT_PUBLISH_TOKEN = `ruiQvAxSn5VL075j9WfTEL7ftvykTXkEgqBvbfFQfsw`

NextAuth:
- [ ] NEXTAUTH_URL = `https://[PROJECT_NAME].vercel.app` (replace with actual URL)

### Step 4: First Deployment

Option A - Manual redeploy:
- [ ] Go to Vercel Dashboard
- [ ] Select app-realisations project
- [ ] Click "Deployments" tab
- [ ] Click "Redeploy" on latest deployment
- [ ] Wait for "Ready" status

Option B - Push commit:
- [ ] Make a small commit: `echo '' >> README.md && git add README.md && git commit -m "trigger: redeploy with env vars"`
- [ ] Push: `git push`
- [ ] Vercel auto-triggers deployment

### Step 5: Deployment Verification

- [ ] Check Vercel Dashboard shows "Ready" ✓
- [ ] Get deployment URL: `https://app-realisations-[random].vercel.app`

## Post-Deployment Testing

### Test 1: Authentication Flow
- [ ] Open deployment URL
- [ ] Should redirect to `/login` (not authenticated)
- [ ] Try login with wrong credentials
  - Username: `wrong`
  - Password: `wrong`
  - Should show error message
- [ ] Check browser console for NextAuth logs

### Test 2: Valid Login
- [ ] Login with valid user:
  - Username: `technicien1`
  - Password: `tech123`
- [ ] Should redirect to `/nouveau`
- [ ] Session should persist on page reload

### Test 3: Form Submission
- [ ] Fill form:
  - Type: `Débouchage`
  - Date: today
  - Ville: `Toulon`
  - Transcription (text): `Débouchage tuyauterie cuisine` (or use voice)
- [ ] Click "Générer rapport + SEO"

### Test 4: Report Generation
- [ ] Generation should start (see loading state)
- [ ] Claude should generate report (~10-15 seconds)
- [ ] Preview should show:
  - Rapport technique (text)
  - SEO description (text)
- [ ] Both should contain relevant keywords

### Test 5: PDF Download
- [ ] Click "Télécharger PDF"
- [ ] Browser should download PDF file
- [ ] PDF should be 2+ pages
- [ ] Check PDF contents:
  - Page 1: Report content
  - Page 2: Images/metadata

### Test 6: LTDB Publishing
- [ ] Click "Publier sur le site"
- [ ] Should show "Publishing..." state
- [ ] If LTDB is accessible:
  - Should return success with new URL
  - URL should point to www.aprime-fluide.fr
- [ ] If LTDB not accessible:
  - Should show appropriate error message
  - Check network tab in DevTools for 400/401/500 errors

### Test 7: Additional Login User
- [ ] Logout and login with `technicien2`/`tech456`
- [ ] Should have same functionality
- [ ] Verify different user isolation (if applicable)

## Troubleshooting Checklist

### Build Failed
- [ ] Check Vercel build logs for exact error
- [ ] Run `npm run build` locally and verify it works
- [ ] Check for missing environment variables in build log
- [ ] Verify no TypeScript errors: `npx tsc --noEmit`

### Deployment Stuck
- [ ] Cancel deployment from Vercel Dashboard
- [ ] Check git history: `git log --oneline`
- [ ] Redeploy manually from Dashboard

### Login Not Working
- [ ] Verify NEXTAUTH_SECRET is set (don't leave empty)
- [ ] Verify NEXTAUTH_URL matches deployment domain
- [ ] Check browser console for NextAuth errors
- [ ] Check Vercel runtime logs: Dashboard > [project] > Deployments > [latest] > Runtime Logs

### API Calls Failing
- [ ] Check Vercel runtime logs for API errors
- [ ] For Whisper: verify OPENAI_API_KEY is set
- [ ] For Claude: verify ANTHROPIC_API_KEY is set
- [ ] For LTDB publish: verify CLIENT_PUBLISH_TOKEN matches Django config

### LTDB Integration Issues
- [ ] Verify CLIENT_API_URL is accessible: curl https://www.aprime-fluide.fr
- [ ] Check Django backend is running
- [ ] Verify CLIENT_PUBLISH_TOKEN matches exactly (check for spaces/typos)
- [ ] Check Django /api/gallery/publish/ endpoint is implemented
- [ ] Monitor server logs on LTDB backend for POST requests

## Success Criteria

All of these should be true:
- [ ] Deployment URL is accessible (no 403/404)
- [ ] Login page loads
- [ ] Can authenticate with test credentials
- [ ] Can access /nouveau page
- [ ] Can submit form
- [ ] Claude generates report without errors
- [ ] Can download PDF
- [ ] Can publish to LTDB (or see appropriate error if backend unavailable)

## Post-Success

- [ ] Add project to monitoring (if applicable)
- [ ] Set up uptime monitoring for Vercel deployment
- [ ] Document actual deployment URL
- [ ] Share credentials with team (securely)
- [ ] Plan regular backups of database (if using Supabase later)
