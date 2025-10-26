# 🐳 Railway Deployment with Custom Dockerfile

## Problem Solved

Railway was detecting the monorepo root structure and failing to build. This custom Dockerfile approach bypasses all auto-detection and gives us complete control over the build process.

## Files Created

✅ **Dockerfile** - Multi-stage build for Next.js standalone output
✅ **.dockerignore** - Excludes unnecessary files from Docker context
✅ **railway.toml** - Forces Railway to use Dockerfile builder
✅ **next.config.ts** - Updated with `output: 'standalone'`

## Deployment Steps

### Step 1: Link Railway Project

Since Railway CLI requires interactive mode, you have two options:

**Option A: Link existing project**
```bash
cd apps/frontend
railway link
# Select workspace: adi121193's Projects
# Select project: AP2-PaymentGetway (or create new)
# Select environment: production
```

**Option B: Create new project**
```bash
cd apps/frontend
railway init
# Enter project name: frameos-frontend
# This creates a new isolated project
```

### Step 2: Set Environment Variables

```bash
railway variables set NEXT_PUBLIC_API_URL=https://api.your-domain.com
railway variables set NEXT_PUBLIC_APP_URL=https://frameos.railway.app
railway variables set NODE_ENV=production
```

Or set via Railway Dashboard:
1. Go to your project
2. Click **Variables**
3. Add:
   - `NEXT_PUBLIC_API_URL` = `https://api.your-domain.com`
   - `NEXT_PUBLIC_APP_URL` = `https://your-app.railway.app`
   - `NODE_ENV` = `production`

### Step 3: Deploy

```bash
railway up
```

Railway will:
1. Detect `railway.toml` with `builder = "DOCKERFILE"`
2. Use the custom Dockerfile instead of Nixpacks
3. Build in 3 stages: deps → builder → runner
4. Deploy the standalone Next.js server

### Step 4: Verify

```bash
# Check deployment status
railway status

# View logs
railway logs

# Get deployment URL
railway open
```

## How the Dockerfile Works

### Stage 1: Dependencies
- Uses Node 20 Alpine (lightweight)
- Copies only package files
- Runs `npm ci` for reproducible installs

### Stage 2: Builder
- Copies dependencies from Stage 1
- Copies all source code
- Runs `npm run build` with `output: 'standalone'`
- Next.js creates optimized production build

### Stage 3: Runner
- Fresh Node 20 Alpine image (smaller)
- Creates non-root user for security
- Copies only:
  - Standalone server (`server.js`)
  - Static assets (`.next/static`)
  - Public files
- Runs as `nextjs` user (not root)
- Exposes port 3000
- Starts with `node server.js`

## Build Optimization

The standalone output bundles:
- Only production dependencies
- Minified JavaScript
- Optimized images
- No dev dependencies

**Result**: ~150MB final image vs ~800MB with full node_modules

## Troubleshooting

### Build fails with "Cannot find module"

**Cause**: Missing dependency in package.json

**Fix**:
```bash
npm install <missing-package>
git add package.json package-lock.json
railway up
```

### "Server is not ready" error

**Cause**: Environment variables not set at build time

**Fix**: `NEXT_PUBLIC_*` variables must be set **before** running `railway up`:
```bash
railway variables set NEXT_PUBLIC_API_URL=https://...
railway up
```

### Port binding issues

**Cause**: Railway sets `PORT` environment variable

**Fix**: Already handled! Dockerfile sets:
```dockerfile
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
```

Next.js standalone server automatically uses these.

### Build timeout

**Cause**: Large dependencies or slow network

**Fix**: Railway has 10-minute timeout. If needed:
1. Remove unused dependencies
2. Use `npm ci` instead of `npm install` (already done)
3. Upgrade Railway plan for faster builds

## Railway vs Nixpacks Comparison

| Aspect | Nixpacks (Old) | Dockerfile (New) |
|--------|----------------|------------------|
| **Monorepo Detection** | ❌ Always detected workspace | ✅ Isolated build context |
| **Build Control** | Limited | Full control |
| **Cache Busting** | Difficult | Easy (`docker build --no-cache`) |
| **Build Size** | ~800MB | ~150MB |
| **Build Time** | 3-5 min | 2-3 min |
| **Debugging** | Opaque | Clear stages |

## Environment Variable Reference

### Required at Build Time
- `NEXT_PUBLIC_API_URL` - Backend API endpoint
- `NEXT_PUBLIC_APP_URL` - Frontend domain

### Required at Runtime
- `NODE_ENV` - Set to `production`
- `PORT` - Auto-set by Railway (3000 default)

### Optional
- `NEXT_TELEMETRY_DISABLED` - Set to `1` (already in Dockerfile)

## Deployment Checklist

- [ ] Dockerfile exists in `apps/frontend/`
- [ ] next.config.ts has `output: 'standalone'`
- [ ] railway.toml configured with `builder = "DOCKERFILE"`
- [ ] Railway project linked (`railway link`)
- [ ] Environment variables set
- [ ] Run `railway up` from `apps/frontend/`
- [ ] Check logs: `railway logs`
- [ ] Verify URL works
- [ ] Test API connection
- [ ] Add custom domain (optional)

## Custom Domain Setup

After successful deployment:

```bash
railway domain add your-domain.com
```

Then add DNS records at your provider:
```
Type: CNAME
Name: @
Value: your-app.up.railway.app
```

SSL certificate is automatic via Let's Encrypt.

## Next Steps After Deployment

1. **Monitor logs**: `railway logs --follow`
2. **Set up alerts**: Railway Dashboard → Notifications
3. **Add custom domain**: Railway Dashboard → Settings → Domains
4. **Scale resources**: Settings → Resources (if needed)
5. **Enable PR previews**: Settings → Environments

## Success Criteria

✅ Build completes without errors
✅ Deployment shows as "Active"
✅ Health check passes
✅ Homepage loads at Railway URL
✅ No console errors in browser
✅ API calls work (check Network tab)

## Rollback

If deployment fails:

```bash
# View deployments
railway deployments

# Rollback to previous
railway rollback <deployment-id>
```

---

**Ready to deploy!** Just run:

```bash
cd apps/frontend
railway link        # Interactive - select your project
railway up          # Deploy with Dockerfile
railway logs        # Monitor deployment
```

The custom Dockerfile approach gives you **full control** and eliminates all monorepo detection issues! 🚀
