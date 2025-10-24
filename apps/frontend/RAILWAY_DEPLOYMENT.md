# 🚂 Railway Deployment Guide - FrameOS Frontend

## 🚀 Quick Deploy to Railway

### Option 1: One-Click Deploy (Easiest)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/frameos-frontend)

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Link to project (if already exists)
railway link

# Deploy
railway up
```

### Option 3: GitHub Integration

1. Go to [railway.app/new](https://railway.app/new)
2. Select **Deploy from GitHub repo**
3. Choose your repository
4. Configure:
   - **Root Directory**: `apps/frontend`
   - **Build Command**: Auto-detected
   - **Start Command**: Auto-detected

---

## ⚙️ Environment Variables

### Required Variables

Add these in **Railway Dashboard → Variables**:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://frameos-production.up.railway.app

# Node Environment
NODE_ENV=production
PORT=3000
```

### Setting Variables via CLI

```bash
# Set individual variables
railway variables set NEXT_PUBLIC_API_URL=https://api-production.up.railway.app
railway variables set NEXT_PUBLIC_APP_URL=https://frameos-production.up.railway.app
railway variables set NODE_ENV=production

# Or set from .env file
railway variables set --from .env.production
```

### Creating .env.production

```bash
# Create production environment file
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://api-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://frameos-production.up.railway.app
NODE_ENV=production
PORT=3000
EOF
```

---

## 📁 Project Configuration

### railway.json

Railway configuration is in `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build --workspace=frontend"
  },
  "deploy": {
    "startCommand": "npm run start --workspace=frontend",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### nixpacks.toml

Nixpacks configuration for Node.js 20:

```toml
[phases.setup]
nixPkgs = ['nodejs-20_x']

[phases.install]
cmds = ['npm install']

[phases.build]
cmds = ['npm run build']

[start]
cmd = 'npm run start'
```

---

## 🌍 Custom Domain Setup

### 1. Add Domain in Railway

```bash
# Via CLI
railway domain

# Follow prompts to add custom domain
```

### 2. Configure DNS

Add these records at your DNS provider:

```
Type    Name    Value
CNAME   @       your-app.up.railway.app
CNAME   www     your-app.up.railway.app
```

Or use Railway's provided DNS records (shown in dashboard).

### 3. Wait for SSL

Railway automatically provisions SSL certificates via Let's Encrypt (takes 1-5 minutes).

---

## 🔧 Build Configuration

### Automatic Detection

Railway automatically detects Next.js projects and configures:
- Node.js 20.x
- npm install
- npm run build
- npm run start

### Custom Configuration

If needed, override in `railway.json` or via dashboard:

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run start
```

**Install Command:**
```bash
npm install --production=false
```

---

## 🚦 Deployment Workflow

### Automatic Deployments

Railway automatically deploys on:
- **Production**: Push to `main` branch
- **Staging**: Create a new environment and link to a branch

### Manual Deployment

```bash
# Deploy current directory
railway up

# Deploy and follow logs
railway up --logs

# Deploy specific service
railway up --service frontend
```

### Preview Deployments

Create preview environments for testing:

```bash
# Create new environment
railway environment create preview

# Switch to preview
railway environment use preview

# Deploy
railway up
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Live logs
railway logs

# Follow logs (tail -f style)
railway logs --follow

# Filter by time
railway logs --since 1h
```

### Metrics Dashboard

View in Railway dashboard:
- CPU usage
- Memory usage
- Network traffic
- Request rate
- Response times

---

## 🔍 Post-Deployment Checks

### 1. Check Deployment Status

```bash
railway status
```

### 2. Test Homepage

```bash
curl -I https://your-app.up.railway.app
# Should return: HTTP/2 200
```

### 3. Verify Environment Variables

```bash
railway variables
```

### 4. Check Build Logs

```bash
railway logs --deployment
```

---

## 🐛 Troubleshooting

### Build Fails

**Check build logs:**
```bash
railway logs --deployment
```

**Common issues:**
- Missing environment variables → Add in dashboard
- Node.js version mismatch → Check `nixpacks.toml`
- Memory limit exceeded → Upgrade plan
- Build timeout → Increase timeout in settings

**Solutions:**
```bash
# Clear build cache
railway run --clean

# Force rebuild
railway up --force
```

### Application Won't Start

**Check start command:**
```bash
railway run bash
npm run start  # Test manually
```

**Common issues:**
- Wrong start command → Update in `railway.json`
- Port binding → Railway sets $PORT automatically
- Missing production dependencies → Check package.json

### Environment Variable Issues

**Verify variables are set:**
```bash
railway variables

# Test in shell
railway run bash
echo $NEXT_PUBLIC_API_URL
```

**Note**: Variables starting with `NEXT_PUBLIC_` must be set at build time.

### High Memory Usage

**Check memory:**
```bash
railway logs | grep -i memory
```

**Solutions:**
- Upgrade to larger plan
- Optimize bundle size
- Enable caching

---

## 💰 Pricing & Resources

### Hobby Plan (Free)
- $5 free credits/month
- 512 MB RAM
- 1 GB disk
- Shared CPU
- Perfect for prototyping

### Developer Plan ($20/month)
- $20 usage credits
- Up to 8 GB RAM
- Up to 32 GB disk
- Shared CPU
- Multiple environments

### Team Plan ($50/month)
- $50 usage credits
- Custom resources
- Priority support
- Team collaboration

---

## 🔄 Rollback Procedure

### Via Dashboard
1. Go to **Deployments**
2. Find previous deployment
3. Click **⋯ → Rollback**

### Via CLI

```bash
# List deployments
railway deployments

# Rollback to previous
railway rollback

# Rollback to specific deployment
railway rollback <deployment-id>
```

---

## 🔒 Security

### Environment Variable Security

Railway encrypts all environment variables at rest and in transit.

### Network Security

Railway provides:
- Automatic HTTPS
- DDoS protection
- Private networking between services

### Best Practices

```bash
# Never commit secrets
echo ".env*" >> .gitfile

# Use Railway secrets for sensitive data
railway variables set DATABASE_PASSWORD=secret --secret

# Rotate credentials regularly
railway variables set API_KEY=new-key
```

---

## 📈 Scaling

### Horizontal Scaling

Railway doesn't support horizontal scaling on Hobby plan.

**For scaling needs:**
1. Upgrade to Developer/Team plan
2. Use Railway's load balancing
3. Or deploy multiple instances manually

### Vertical Scaling

Increase resources in **Settings → Resources**:
- Memory: 512 MB → 8 GB
- CPU: Shared → Dedicated
- Disk: 1 GB → 32 GB

---

## 🔗 Multi-Service Setup

If deploying both frontend and backend:

### 1. Create Services

```bash
# Create frontend service
railway service create frontend

# Create backend service
railway service create backend
```

### 2. Link Services

```bash
# Set backend URL in frontend
railway variables set NEXT_PUBLIC_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

### 3. Private Networking

Services can communicate via Railway's private network:

```bash
# Backend URL (private)
http://backend.railway.internal:3000
```

---

## 🎯 Production Checklist

Before going live:

- [ ] Environment variables configured
- [ ] Custom domain added and verified
- [ ] SSL certificate active (automatic)
- [ ] Backend API connected
- [ ] Build successful
- [ ] Start command working
- [ ] Health checks passing
- [ ] Logs clean (no errors)
- [ ] Memory usage acceptable
- [ ] Response times acceptable
- [ ] Backup plan documented

---

## 🆚 Railway vs Vercel

| Feature | Railway | Vercel |
|---------|---------|--------|
| **Pricing** | Pay-as-you-go ($5 free) | Hobby free, Pro $20/mo |
| **Build Time** | ~2-3 min | ~1-2 min |
| **Databases** | Built-in Postgres, Redis | External only |
| **Containerization** | Docker support | Serverless only |
| **Backend** | Full backend support | Serverless functions |
| **Private Networking** | ✅ Yes | ❌ No |
| **Best For** | Full-stack apps | Frontend + serverless |

**Use Railway if:**
- You need a database
- You have a backend API
- You want private networking
- You prefer pay-as-you-go

**Use Vercel if:**
- Frontend-only app
- Serverless architecture
- Want fastest builds
- Edge network important

---

## 📞 Support & Resources

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **CLI Reference**: [docs.railway.app/develop/cli](https://docs.railway.app/develop/cli)
- **Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Status**: [status.railway.app](https://status.railway.app)

---

## 🚀 Quick Deploy Commands

```bash
# Complete deployment flow
railway login
railway init
railway variables set NEXT_PUBLIC_API_URL=https://api.railway.app
railway variables set NODE_ENV=production
railway up

# Monitor deployment
railway logs --follow

# Check status
railway status

# Add custom domain
railway domain add frameos.dev
```

---

## 📝 Example railway.toml (Alternative)

If you prefer `railway.toml` over `railway.json`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[healthcheck]
path = "/api/health"
interval = 30
timeout = 10
```

---

**Last Updated**: 2025-01-15

**Deploy to Railway**: `railway up` 🚂
