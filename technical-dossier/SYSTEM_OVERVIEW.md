# System Overview: Argos Portfolio Tracker

## Technology Stack

- **Framework**: React (Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query (`@tanstack/react-query`), Context API
- **Backend/Database**: Supabase
- **Routing**: `react-router-dom`
- **Visualization**: Recharts

## Project Structure

- `src/`
    - `components/`: UI components (Dashboard, Financing, etc.)
    - `contexts/`: React Contexts (Auth, Theme, Portfolio)
    - `hooks/`: Custom React hooks
    - `pages/`: Route components
    - `services/`: API services and business logic
    - `types/`: TypeScript definitions
    - `utils/`: Helper functions and constants

## Configuration

- `vite.config.ts`: Vite configuration
- `tailwind.config.js`: Tailwind configuration
- `tsconfig.json`: TypeScript configuration

## Key Dependencies

- `@supabase/supabase-js`: Supabase client
- `@tanstack/react-query`: Data fetching
- `recharts`: Charting library
- `lucide-react`: Icons

## Anomalies

- `next` is listed in `dependencies` but the project is configured as a Vite app. This suggests a potential migration attempt or misconfiguration.
