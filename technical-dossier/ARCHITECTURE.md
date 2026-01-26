# System Architecture & Data Flow

## Overview

The application follows a **Client-First** architecture with serverless backend features provided by Supabase.

```mermaid
graph TD
    User[User Browser] -->|Auth & Data| Supabase[Supabase (PostgreSQL)]
    User -->|Market Data| BondAPI[External Bond API]
    User -->|Static Assets| Vercel[Vercel CDN]

    subgraph Client [React Application]
        Auth[AuthContext]
        Query[React Query Cache]
        Store[Zustand/Context Store]
        
        Auth --> Query
        Query --> Components
    end
```

## Data Flow Patterns

### 1. Authentication
- **Provider**: `AuthContext` wraps the application.
- **Mechanism**: Supabase Auth (JWT).
- **Persistence**: Session stored in `localStorage` (managed by Supabase client).

### 2. Data Fetching (React Query)
- **Pattern**: Custom hooks (e.g., `useBondPrices`, `useOperations`) encapsulate data fetching.
- **Caching**: Aggressive caching with `staleTime` to minimize DB hits.
- **Realtime**: Subscription to Supabase changes (if enabled) or manual invalidation on mutation.

### 3. State Management
- **Local State**: `useState` for form inputs.
- **Server State**: `React Query` is the source of truth for portfolio data.
- **Global UI State**: Context API for Theme and Portfolio selection.

## Key Directories

- `src/services/`: **The integration layer**. Contains strict types and logic for communicating with Supabase.
- `src/hooks/`: **The binding layer**. Connects Services to Components via React Query.
- `src/utils/`: **The domain layer**. Pure functions for financial math (Financial Guard).

## Deployment

- **Frontend**: Vite build -> Static files -> Deployed to Vercel/Netlify.
- **Database**: Managed Supabase instance.
- **Edge Functions**: (If applicable) Supabase Edge Functions for heavy calculations.
