import pandas as pd
from engine import FundingCarryEngine

# Use mock data for testing
engine = FundingCarryEngine(use_mock=True)

# Calculate spread
print("Running Spread Calculation...")
df, kpis = engine.calculate_spread()

if df.empty:
    print("❌ Error: No data returned")
else:
    print("\n✅ Data Calculated Successfully")
    print("\n--- KPI Summary ---")
    for k, v in kpis.items():
        if isinstance(v, dict):
            print(f"{k}: {v}")
        else:
            print(f"{k}: {v:.2f}")

    print("\n--- First 5 Days ---")
    print(df[['date', 'fci_balance', 'caucion_viva', 'spread', 'capital_productivo']].head().to_string())

    # Check logic
    row = df.iloc[0]
    expected_cap_prod = min(row['fci_balance'], row['caucion_viva'])
    if abs(row['capital_productivo'] - expected_cap_prod) < 0.01:
        print("\n✅ Capital Productivo Logic Verified: min(fci, caucion)")
    else:
        print(f"\n❌ Logic Error: Got {row['capital_productivo']}, expected {expected_cap_prod}")
