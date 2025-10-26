# Railway Deployment Checklist ✅

## Prerequisites
- [ ] Railway account created
- [ ] Railway CLI installed (`npm i -g @railway/cli`)
- [ ] Docker installed (for local testing - optional)
- [ ] Git repository up to date

## Step 1: Environment Configuration
```bash
cd apps/frontend
```

### Set Required Variables in Railway Dashboard
1. Navigate to your Railway project
2. Go to **Variables** tab
3. Add the following:

**Build-time (Required)**
- [ ] `NEXT_PUBLIC_API_URL` = `https://your-api-domain.railway.app`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://your-frontend-domain.railway.app`

**Runtime (Required)**
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000` (auto-set by Railway)

**Optional**
- [ ] `NEXT_TELEMETRY_DISABLED` = `1`

## Step 2: Link Railway Project

### Option A: Link Existing Project
```bash
railway link
# Select: workspace → project → environment
```

### Option B: Create New Project
```bash
railway init
# Enter project name: frameos-frontend
```

- [ ] Railway project linked

## Step 3: Deploy

```bash
railway up
```

**Expected output:**
```
Building Dockerfile...
✓ deps stage complete
✓ builder stage complete
✓ runner stage complete
Deploying...
✓ Deployment successful
```

- [ ] Deployment succeeded

## Step 4: Verify Deployment

```bash
# Check status
railway status

# View logs
railway logs

# Open deployment
railway open
```

### Manual Verification
- [ ] Homepage loads without errors
- [ ] Check browser console (F12) - no JavaScript errors
- [ ] API calls work (check Network tab)
- [ ] Authentication flow works
- [ ] Navigation between pages works
- [ ] Images and assets load correctly

## Step 5: Custom Domain (Optional)

```bash
railway domain add your-domain.com
```

### DNS Configuration
Add at your domain provider:
```
Type: CNAME
Name: @
Value: your-app.up.railway.app
TTL: 3600
```

- [ ] Custom domain configured
- [ ] DNS propagated (check with `dig your-domain.com`)
- [ ] SSL certificate active (automatic via Let's Encrypt)

## Troubleshooting

### Build Fails
```bash
# Check build logs
railway logs --deployment

# Common issues:
# 1. Missing environment variables
# 2. Dependency installation failed
# 3. Build timeout (upgrade Railway plan)
```

### Deployment Shows "Unhealthy"
```bash
# Check runtime logs
railway logs

# Common issues:
# 1. Port not exposed (should be 3000)
# 2. Server not binding to 0.0.0.0
# 3. Environment variables not set
```

### Page Shows "Server Error"
- Check `NEXT_PUBLIC_API_URL` is set correctly
- Verify API backend is running
- Check browser console for specific errors

## Rollback Procedure

If deployment fails:
```bash
# List deployments
railway deployments

# Rollback to previous version
railway rollback <deployment-id>
```

## Performance Optimization

### After Initial Deployment
- [ ] Enable Railway caching (automatic)
- [ ] Monitor deployment metrics in dashboard
- [ ] Set up health checks (Railway auto-detects)
- [ ] Configure restart policy (already set in railway.toml)

### Monitoring
```bash
# Watch logs in real-time
railway logs --follow

# Check resource usage
railway metrics
```

## Security Checklist
- [ ] No secrets in environment variables (use Railway secrets)
- [ ] CORS configured correctly in backend
- [ ] CSP headers configured (if needed)
- [ ] Rate limiting enabled on API
- [ ] Authentication working correctly

## Post-Deployment Tasks
- [ ] Update DNS records (if using custom domain)
- [ ] Test all critical user flows
- [ ] Monitor error rates for 24 hours
- [ ] Set up Railway notifications (Settings → Notifications)
- [ ] Document deployment date and version
- [ ] Notify team of new deployment

## Quick Commands Reference

```bash
# Deploy
railway up

# View logs
railway logs
railway logs --follow

# Check status
railway status

# Open in browser
railway open

# Restart service
railway restart

# Environment variables
railway variables
railway variables set KEY=value

# Rollback
railway deployments
railway rollback <id>
```

## Support Resources

- Railway Docs: https://docs.railway.app
- Next.js Deployment: https://nextjs.org/docs/deployment
- Project Docs: `./DOCKER_RAILWAY_DEPLOY.md`

---

**Last Updated:** 2025-10-26
**Deployment Method:** Docker (multi-stage)
**Build Time:** ~2-3 minutes
**Image Size:** ~150MB
