# Database Schema: Argos Portfolio Tracker

## Overview

The database is built on **Supabase** (PostgreSQL) and uses **Row Level Security (RLS)** to isolate user data.

## Core Tables

### 1. `portfolios`
Container for a collection of trades.

- `id`: UUID (PK)
- `user_id`: UUID (FK to `auth.users`)
- `name`: TEXT
- `description`: TEXT
- `currency`: TEXT (Default 'ARS')
- `is_default`: BOOLEAN
- `created_at` / `updated_at`: TIMESTAMP

### 2. `trades`
Records financial transactions within a portfolio.

- `id`: UUID (PK)
- `portfolio_id`: UUID (FK to `portfolios`)
- `user_id`: UUID (FK to `auth.users`)
- `ticker`: TEXT (e.g., "AAPL", "AL30")
- `trade_type`: TEXT ('buy', 'sell')
- `quantity`: DECIMAL(18, 8)
- `price`: DECIMAL(18, 8) (Price per unit)
- `total_amount`: DECIMAL(18, 2)
- `commission`: DECIMAL(18, 2)
- `currency`: TEXT (Default 'ARS')
- `trade_date`: DATE
- `notes`: TEXT

## Security (RLS)

- Policies enforce that users can only SELECT, INSERT, UPDATE, DELETE rows where `user_id = auth.uid()`.
- Both `portfolios` and `trades` tables have RLS enabled.

## Triggers

- `update_updated_at_column`: Automatically updates the `updated_at` timestamp on modification.

