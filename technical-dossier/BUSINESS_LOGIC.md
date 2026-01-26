# Business Logic & Financial Core

## Overview

The application enforces strict financial precision using `decimal.js` and a custom "Financial Guard" system. All monetary calculations must bypass native JavaScript `number` math to prevent floating-point errors.

## Core Services

### 1. Financing Service (`src/services/financingService.ts`)
Manages "Cauciones" (Secured Loans/Bonds).

- **Ingestion**: Parses CSVs from brokers.
- **Persistence**: Uses `upsert` with `operation_key` deduplication.
- **Calculations**:
    - **Interest**: `Monto Devolver - Capital`
    - **TNA (Annual Nominal Rate)**: Weighted average by capital.
    - **Days**: `(EndDate - StartDate)` in days.

### 2. Financial Guard (`src/utils/financialCalculationGuard.ts`)
A runtime enforcement system.

- **Purpose**: Prevents developers from using `number` for money.
- **Mechanism**:
    - Throws errors if `calculateInterestLegacy` is called.
    - Validates inputs are `Decimal` instances.
    - Logs warnings in development if suspicious math is detected (e.g., `* 0.`).

## Key Formulas

### Weighted TNA (Turnover / Yield)
Used in `getMetrics`:

$$
\text{TNA}_{weighted} = \frac{\sum (\text{Capital}_i \times \text{TNA}_i)}{\sum \text{Capital}_i}
$$

### Weighted Duration
$$
\text{Days}_{avg} = \frac{\sum (\text{Capital}_i \times \text{Days}_i)}{\sum \text{Capital}_i}
$$

## Data Ingestion (CSV)

- ** Deduplication**: Custom logic checks for existing operations with identical `fecha_inicio` and `capital` (within 0.01 tolerance).
- ** Idempotency**: The `upsert` mechanism ensures re-uploading the same CSV doesn't duplicate records.
