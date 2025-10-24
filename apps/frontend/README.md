# FrameOS Frontend

> The official web interface for the FrameOS AI Agent Marketplace

Built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS 4**.

---

## 🎯 Features

### Public Pages
- **Homepage**: Hero section with featured agents and call-to-actions
- **Marketplace**: Browse and search AI agents with filters (category, search, sort)
- **Agent Detail**: View agent information, pricing, reviews, and execute
- **Category Browse**: Browse agents by category (9 categories)
- **Execution Status**: Real-time execution tracking with auto-refresh

### Authenticated Pages (Developer Portal)
- **Dashboard**: Analytics overview with revenue, agents, and execution stats
- **My Agents**: Manage published agents with search/filter
- **Register Agent**: Upload agent code (ZIP) with complete manifest form
- **Edit Agent**: Update agent details, pricing, and status
- **Revenue**: Track earnings with time periods and agent breakdown
- **API Keys**: Create/manage API keys for programmatic access
- **Profile**: Update account settings and change password

### UI/UX Features
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Dark Mode Ready**: Prepared for theme switching
- **Loading States**: Skeleton loaders and loading indicators
- **Error Handling**: Global error boundaries and 404 pages
- **Toast Notifications**: User feedback with Sonner
- **Form Validation**: Client-side validation with Zod + React Hook Form
- **Accessibility**: ARIA labels, keyboard navigation, semantic HTML

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000  # Backend API URL
```

---

## 📁 Project Structure

```
apps/frontend/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── (auth)/            # Auth pages (login, signup)
│   │   ├── (dashboard)/       # Developer portal pages
│   │   ├── marketplace/       # Public marketplace pages
│   │   ├── executions/        # Execution status pages
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Homepage
│   │   ├── error.tsx          # Error boundary
│   │   ├── not-found.tsx      # 404 page
│   │   └── sitemap.ts         # Dynamic sitemap
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── shared/            # Shared components (Navbar, Footer)
│   │   ├── dashboard/         # Dashboard-specific components
│   │   └── marketplace/       # Marketplace-specific components
│   ├── lib/
│   │   ├── api-client.ts      # API client with typed methods
│   │   ├── types.ts           # TypeScript type definitions
│   │   ├── constants.ts       # App constants
│   │   ├── utils.ts           # Utility functions
│   │   └── providers.tsx      # React Query provider
│   ├── hooks/
│   │   ├── use-agents.ts      # Agent data fetching hooks
│   │   └── use-executions.ts  # Execution data fetching hooks
│   └── stores/
│       └── auth-store.ts      # Zustand auth state
├── public/                     # Static assets
│   ├── manifest.json          # PWA manifest
│   └── robots.txt             # SEO robots file
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Components** | shadcn/ui + Radix UI |
| **Forms** | React Hook Form + Zod |
| **State** | Zustand + React Query |
| **HTTP Client** | Axios |
| **Notifications** | Sonner |
| **Icons** | Lucide React |
| **Markdown** | react-markdown |

---

## 📦 Available Scripts

```bash
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

---

## 🎨 UI Components

Built with **shadcn/ui** - a collection of reusable components built on Radix UI:

- Alert, Alert Dialog
- Avatar, Badge, Button
- Card, Dialog, Dropdown Menu
- Form, Input, Label
- Select, Separator, Skeleton
- Tabs, Textarea, Toast (Sonner)

All components are fully typed, accessible, and customizable via Tailwind.

---

## 🔑 Authentication Flow

1. **Signup/Login**: User creates account or logs in
2. **Token Storage**: JWT token stored in localStorage
3. **API Client**: Token automatically attached to all requests
4. **Protected Routes**: ProtectedRoute component wraps dashboard pages
5. **Auth Store**: Zustand manages global auth state

```typescript
// Usage
const { isAuthenticated, developer, login, logout } = useAuthStore();
```

---

## 🌐 API Integration

The frontend connects to the FrameOS backend API. API client is located at `src/lib/api-client.ts`.

### Typed API Methods

```typescript
// List agents
const agents = await apiClient.listAgents({
  category: 'automation',
  search: 'email',
  sort: 'popular',
  limit: 20
});

// Execute agent
const execution = await apiClient.executeAgent(agentId, {
  inputs: { email: 'user@example.com' }
});

// Get execution status
const status = await apiClient.getExecution(executionId);
```

### React Query Integration

```typescript
// Using hooks for data fetching
const { data: agents, isLoading } = useAgents({
  category: 'automation'
});

const { data: execution } = useExecution(executionId, {
  refetchInterval: 2000 // Auto-refresh every 2s
});
```

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Environment Variables on Vercel

Add the following in Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://api.frameos.dev
```

### Build Configuration

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

---

## 🔒 Security

- ✅ No secrets in frontend code
- ✅ API keys stored in localStorage (encrypted in transit)
- ✅ CSRF protection via SameSite cookies
- ✅ Content Security Policy headers
- ✅ XSS protection via React's automatic escaping
- ✅ Input validation on all forms

---

## ♿ Accessibility

- ✅ Semantic HTML5 elements
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Screen reader compatible
- ✅ Color contrast ratios (WCAG AA)

---

## 📊 Performance

- ✅ Next.js automatic code splitting
- ✅ Image optimization (AVIF/WebP)
- ✅ React 19 concurrent features
- ✅ Static page generation where possible
- ✅ API response caching with React Query
- ✅ Console logs removed in production

---

## 📝 License

Proprietary - FrameOS Team

---

**Built with ❤️ by the FrameOS Team**
