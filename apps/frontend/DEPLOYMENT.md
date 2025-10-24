# FrameOS Frontend Deployment Guide

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
- Vercel account
- Git repository connected to Vercel
- Backend API deployed and accessible

### Quick Deploy

#### Option 1: Deploy Button (Easiest)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/frameos/frontend)

#### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Option 3: GitHub Integration

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

---

## ⚙️ Environment Variables

Add these in **Vercel Dashboard → Settings → Environment Variables**:

### Required Variables

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.frameos.dev` | Production |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.frameos.dev` | Preview |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Development |
| `NEXT_PUBLIC_APP_URL` | `https://frameos.dev` | Production |
| `NODE_ENV` | `production` | Production |

### Setting Environment Variables

```bash
# Via Vercel CLI
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_APP_URL production

# Or via Dashboard
# Go to: Settings → Environment Variables → Add New
```

---

## 🌍 Custom Domain Setup

### 1. Add Domain in Vercel

```bash
# Via CLI
vercel domains add frameos.dev

# Or via Dashboard
# Settings → Domains → Add Domain
```

### 2. Configure DNS

Add these records at your DNS provider:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### 3. Wait for SSL

SSL certificates are automatically provisioned (usually takes 1-5 minutes).

---

## 🔧 Build Configuration

The frontend uses the following build settings:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "nodejs": "20.x"
}
```

These are defined in `vercel.json` and automatically applied.

---

## 🚦 Deployment Workflow

### Automatic Deployments

Vercel automatically deploys:
- **Production**: On push to `main` branch
- **Preview**: On push to any other branch or pull request

### Preview Deployments

Every pull request gets a unique preview URL:
```
https://frameos-git-feature-branch-team.vercel.app
```

Share preview links with team members for review.

---

## 🔍 Post-Deployment Checks

After deploying, verify:

### 1. Homepage Loads
```bash
curl -I https://frameos.dev
# Should return: HTTP/2 200
```

### 2. API Connection
```bash
# Check browser console at https://frameos.dev/marketplace
# Should show successful API calls (or mock data if backend not ready)
```

### 3. Static Assets
```bash
curl -I https://frameos.dev/manifest.json
curl -I https://frameos.dev/robots.txt
# Both should return 200 OK
```

### 4. SEO Tags
```bash
curl https://frameos.dev | grep -i "og:title"
# Should show: FrameOS - The AI Agent Marketplace
```

---

## 🐛 Troubleshooting

### Build Fails

**Check build logs:**
```bash
vercel logs <deployment-url>
```

**Common issues:**
- Missing environment variables → Add them in dashboard
- TypeScript errors → Run `npm run build` locally first
- Memory limit → Increase in Vercel dashboard (requires Pro plan)

### API Connection Issues

**Symptom**: Frontend loads but can't fetch data

**Solution**:
1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Check CORS settings on backend
3. Verify backend API is deployed and accessible

### Slow Build Times

**Solution**:
1. Enable caching in Vercel dashboard
2. Use `vercel.json` to configure build settings
3. Consider upgrading to Pro plan for faster builds

### 404 on Routes

**Symptom**: Direct navigation to `/marketplace` returns 404

**Solution**:
- This is a Next.js routing issue
- Ensure `next.config.ts` has correct configuration
- Vercel automatically handles Next.js routing, no `.htaccess` needed

---

## 📊 Monitoring & Analytics

### Vercel Analytics

Enable in dashboard:
1. Go to **Analytics** tab
2. Click **Enable Analytics**
3. View real-time metrics

### Performance Monitoring

```bash
# Check Web Vitals
vercel inspect <deployment-url>
```

Metrics tracked:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

---

## 🔄 Rollback Procedure

### Via Dashboard
1. Go to **Deployments**
2. Find previous deployment
3. Click **⋯ → Promote to Production**

### Via CLI
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel alias set <deployment-url> frameos.dev
```

---

## 🔒 Security Headers

These headers are automatically applied (via `vercel.json`):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 📈 Scaling

Vercel automatically scales based on traffic:
- **Hobby plan**: 100GB bandwidth/month
- **Pro plan**: 1TB bandwidth/month + priority support
- **Enterprise**: Custom limits + SLA

No manual scaling configuration needed.

---

## 🎯 Production Checklist

Before going live:

- [ ] Environment variables configured
- [ ] Custom domain added and verified
- [ ] SSL certificate active
- [ ] Backend API connected and tested
- [ ] Error tracking enabled (Sentry recommended)
- [ ] Analytics enabled
- [ ] SEO tags verified
- [ ] Performance audit passed (Lighthouse score > 90)
- [ ] Mobile responsiveness tested
- [ ] Cross-browser testing completed
- [ ] Backup/rollback plan documented

---

## 📞 Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **FrameOS Team**: support@frameos.dev

---

**Last updated**: 2025-01-15
