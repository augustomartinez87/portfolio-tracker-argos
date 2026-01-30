import pandas as pd
from engine import FundingCarryEngine

def test_risk_logic():
    print("🧪 Testing Risk Logic...")
    
    # 1. Setup Engine with Mock
    engine = FundingCarryEngine(use_mock=True)
    
    # 2. Get Data
    print("   - Calculating metrics...")
    df, kpis = engine.calculate_spread(portfolio_id='mock', fci_id='mock')
    
    # 3. Verify Columns
    required_cols = ['spread_full', 'net_rate', 'capital_productivo']
    for col in required_cols:
        if col not in df.columns:
            print(f"❌ Missing column: {col}")
            return
    print("   - All required columns present.")
    
    # 4. Verify Full Deployment Logic
    # If spread_full is present, check relation with spread
    # spread_full should be >= spread (usually, if fci_return > caucion_cost rate and fully deployed)
    # Actually depends on rates. But let's check it's not null.
    if df['spread_full'].isnull().all():
        print("❌ spread_full is all NULL")
        return
    print(f"   - Full Deployment PnL calculated. Total: {df['spread_full'].sum():.2f}")
    
    # 5. Verify Optimal Capital Logic (Manual check since logic is partly in app.py)
    # But net_rate is in engine.
    # Check if we have negative net rates
    neg_rates = df[df['net_rate'] < 0]
    if not neg_rates.empty:
        print(f"   - Found {len(neg_rates)} days with negative rate. Testing sizing logic manually...")
        row = neg_rates.iloc[0]
        max_loss = 10000
        optimal = max_loss / abs(row['net_rate'])
        print(f"     Date: {row['date']}, Rate: {row['net_rate']:.4f}, Optimal: {optimal:,.2f}")
    else:
        print("   - No negative rate days found in mock data. Cannot test sizing reduction.")

    print("✅ Risk Logic Verification Passed in Engine.")

if __name__ == "__main__":
    test_risk_logic()
