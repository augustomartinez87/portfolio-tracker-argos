import pandas as pd
import numpy as np
import os
import json
from datetime import date, datetime, timedelta
import uuid
from pathlib import Path

# Configuration: Get Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Try to get from st.secrets if missing (Streamlit Cloud)
if not SUPABASE_URL or not SUPABASE_KEY:
    try:
        import streamlit as st
        if "SUPABASE_URL" in st.secrets:
            SUPABASE_URL = st.secrets["SUPABASE_URL"]
        if "SUPABASE_KEY" in st.secrets:
            SUPABASE_KEY = st.secrets["SUPABASE_KEY"]
    except:
        pass


def load_local_mep_history():
    """
    Load MEP history from local JSON file as fallback.
    Returns a pandas Series indexed by date.
    """
    try:
        # Try multiple possible paths to find mepHistory.json
        possible_paths = [
            # From funding_engine/engine.py -> ../src/data/
            Path(__file__).resolve().parent.parent / 'src' / 'data' / 'mepHistory.json',
            # From CWD if running from project root
            Path.cwd() / 'src' / 'data' / 'mepHistory.json',
            # From CWD if running from funding_engine/
            Path.cwd().parent / 'src' / 'data' / 'mepHistory.json',
        ]

        json_path = None
        for p in possible_paths:
            if p.exists():
                json_path = p
                break

        if json_path and json_path.exists():
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if data:
                df = pd.DataFrame(data)
                print(f"[OK] MEP history loaded: {len(data)} records from {json_path.name}")
                return pd.Series(df['price'].values, index=df['date'])

        print(f"[WARN] Local mepHistory.json not found. Tried: {[str(p) for p in possible_paths]}")
        return pd.Series()
    except Exception as e:
        print(f"Error loading local MEP history: {e}")
        return pd.Series()


def create_mock_cauciones():
    """Creates mock cauciones data for demo/testing"""
    demo_portfolio_id = str(uuid.uuid4())
    start_date = date.today() - timedelta(days=30)
    
    cauciones = []
    curr_date = start_date
    while curr_date < date.today():
        capital = 20_000_000.0
        tna = 32.0  # Stored as percentage
        dias = 7
        interes = (capital * (tna/100) * dias) / 365
        
        cauciones.append({
            'id': str(uuid.uuid4()),
            'portfolio_id': demo_portfolio_id,
            'fecha_inicio': curr_date.isoformat(),
            'fecha_fin': (curr_date + timedelta(days=dias)).isoformat(),
            'capital': capital,
            'monto_devolver': capital + interes,
            'interes': interes,
            'dias': dias,
            'tna_real': tna
        })
        curr_date += timedelta(days=dias)
    
    return pd.DataFrame(cauciones)


class FundingCarryEngine:
    def __init__(self, use_mock=True, user_id=None):
        self.use_mock = use_mock
        self.user_id = user_id  # User ID for filtering data
        self.supabase = None
        
        if not use_mock:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required. Check Streamlit Secrets.")
            
            # Initialize Supabase client
            from supabase import create_client
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    def get_portfolio_ids(self):
        """Returns list of unique portfolio_ids available in Cauciones for the user"""
        if self.use_mock:
            mock_data = create_mock_cauciones()
            return mock_data['portfolio_id'].unique().tolist()
        
        # Query Supabase for distinct portfolio_ids filtered by user_id
        try:
            query = self.supabase.table('cauciones').select('portfolio_id')
            
            # Filter by user_id if provided
            if self.user_id:
                query = query.eq('user_id', self.user_id)
            
            response = query.execute()
            if response.data and len(response.data) > 0:
                portfolio_ids = list(set([row['portfolio_id'] for row in response.data if row.get('portfolio_id')]))
                if portfolio_ids:
                    return portfolio_ids
            
            # If no data from real DB, fall back to mock for demo
            print("⚠️ No portfolios found in DB. Using mock data for demo.")
            mock_data = create_mock_cauciones()
            return mock_data['portfolio_id'].unique().tolist()
        except Exception as e:
            print(f"Error fetching portfolio_ids: {e}")
            # Fall back to mock
            mock_data = create_mock_cauciones()
            return mock_data['portfolio_id'].unique().tolist()

    def _fetch_cauciones(self, portfolio_id=None):
        """Fetches cauciones from Supabase or mock"""
        if self.use_mock:
            return create_mock_cauciones()
        
        try:
            query = self.supabase.table('cauciones').select('*')
            
            # Filter by user_id if provided
            if self.user_id:
                query = query.eq('user_id', self.user_id)
            
            if portfolio_id and portfolio_id != 'all':
                query = query.eq('portfolio_id', portfolio_id)
            
            response = query.execute()
            if response.data and len(response.data) > 0:
                return pd.DataFrame(response.data)
            
            # If no data, show empty state
            print("ℹ️ No cauciones found for this user/portfolio.")
            return pd.DataFrame()
        except Exception as e:
            print(f"Error fetching cauciones: {e}")
            return pd.DataFrame()

    def calculate_metrics(self, portfolio_id=None, start_date=None, end_date=None):
        """
        Main calculation engine.
        Currently shows only DEBT side (Interest Cost).
        FCI/Carry calculations pending until FCI module is implemented.
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Fetch Cauciones Data
        cauciones = self._fetch_cauciones(portfolio_id)
        
        if cauciones.empty:
            return pd.DataFrame(), {}
        
        # Convert date columns to ISO strings for reliable comparison
        cauciones['fecha_inicio_str'] = pd.to_datetime(cauciones['fecha_inicio']).dt.strftime('%Y-%m-%d')
        cauciones['fecha_fin_str'] = pd.to_datetime(cauciones['fecha_fin']).dt.strftime('%Y-%m-%d')
        
        # Process Daily Timeline
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        daily_stats = []
        
        for d in date_range:
            d_str = d.strftime('%Y-%m-%d')
            
            # Calculate Debt State
            # Include cauciones that expire TODAY as still active (rollover strategy)
            active_cauciones = cauciones[
                (cauciones['fecha_inicio_str'] <= d_str) & 
                (cauciones['fecha_fin_str'] > d_str)  # > excludes maturity date (settled during day)
            ]
            
            total_debt = float(active_cauciones['capital'].sum()) if not active_cauciones.empty else 0.0
            daily_interest_cost = 0.0
            weighted_tna = 0.0
            
            if total_debt > 0 and not active_cauciones.empty:
                # Ensure properly typed series for calculation
                capitals = pd.to_numeric(active_cauciones['capital'], errors='coerce').fillna(0)
                tnas = pd.to_numeric(active_cauciones['tna_real'], errors='coerce').fillna(0)
                
                # Check if we have valid TNA data
                if tnas.sum() > 0:
                    weighted_tna = np.average(tnas, weights=capitals)
                    daily_interest_cost = (total_debt * (weighted_tna / 100.0)) / 365.0
                else:
                    print(f"Warning: Zero TNA found for date {d_str}")
            
            daily_stats.append({
                'date': d_str,
                'total_debt': total_debt,
                'weighted_tna': weighted_tna,
                'daily_interest_cost': daily_interest_cost,
            })

        df_daily = pd.DataFrame(daily_stats)
        
        # Summary KPIs (Canonical Definition)
        if not df_daily.empty:
            avg_debt = df_daily['total_debt'].mean()
            total_interest = df_daily['daily_interest_cost'].sum()
            
            # 1. Calculate TNA Funding (Canonical: Weighted by Capital * Days)
            # We need to look at the cauciones involved in this period to get the true cost of funding
            # TNA_Funding = Sum(Capital * TNA * Days) / Sum(Capital * Days)
            
            # Filter cauciones that intersect with the period (using ISO strings)
            start_iso = pd.to_datetime(start_date).strftime('%Y-%m-%d')
            end_iso = pd.to_datetime(end_date).strftime('%Y-%m-%d')
            
            period_cauciones = cauciones[
                (cauciones['fecha_fin_str'] >= start_iso) & 
                (cauciones['fecha_inicio_str'] <= end_iso)
            ]
            
            if not period_cauciones.empty:
                # Ensure numeric types
                p_cap = pd.to_numeric(period_cauciones['capital'], errors='coerce').fillna(0)
                p_tna = pd.to_numeric(period_cauciones['tna_real'], errors='coerce').fillna(0)
                p_days = pd.to_numeric(period_cauciones['dias'], errors='coerce').fillna(0) # Use contractual days for weighting
                # Or calculate overlapping days if we want period-specific cost, 
                # but "TNA Funding" usually refers to the contracted rate of the funding mix.
                # Let's use the contracted weighted average as requested.
                
                numerator = (p_cap * p_tna * p_days).sum()
                denominator = (p_cap * p_days).sum()
                
                canonical_tna = numerator / denominator if denominator > 0 else 0.0
            else:
                canonical_tna = 0.0

            # 2. Current Debt (Canonical: Capital + Accrued Interest / Monto Devolver)
            # For "Deuda Actual", we take the last day's active cauciones
            last_date_str = df_daily.iloc[-1]['date']
            
            current_active = cauciones[
                (cauciones['fecha_inicio_str'] <= last_date_str) & 
                (cauciones['fecha_fin_str'] >= last_date_str)
            ]
            
            current_debt = 0.0
            if not current_active.empty:
                # Deuda = Sum(Monto Devolver) -> This assumes full interest is owed if active
                # For "Settlement value" this is correct.
                monto_dev = pd.to_numeric(current_active['monto_devolver'], errors='coerce').fillna(0)
                current_debt = monto_dev.sum()
            
            kpis = {
                'avg_debt': avg_debt,
                'total_interest': total_interest,
                'avg_tna': canonical_tna,
                'current_debt': current_debt,
            }
        else:
            kpis = {}
            
        return df_daily, kpis

    # =========================================================================
    # SPREAD ENGINE: FCI vs Caución
    # =========================================================================

    def _fetch_fci_prices(self, fci_id, start_date=None, end_date=None):
        """
        Fetch VCP history from fci_prices table.
        Returns DataFrame with columns: fecha, vcp
        """
        if self.use_mock:
            # Create mock FCI prices for demo
            return self._create_mock_fci_prices(start_date, end_date)
        
        try:
            query = self.supabase.table('fci_prices').select('fecha, vcp').eq('fci_id', fci_id)
            
            if start_date:
                query = query.gte('fecha', pd.to_datetime(start_date).strftime('%Y-%m-%d'))
            if end_date:
                # Fetch D+1 day for offset calculation
                end_plus_one = pd.to_datetime(end_date) + timedelta(days=1)
                query = query.lte('fecha', end_plus_one.strftime('%Y-%m-%d'))
            
            response = query.order('fecha', desc=False).execute()
            
            if response.data and len(response.data) > 0:
                df = pd.DataFrame(response.data)
                df['fecha'] = pd.to_datetime(df['fecha']).dt.strftime('%Y-%m-%d')
                df['vcp'] = pd.to_numeric(df['vcp'], errors='coerce')
                return df
            
            print("ℹ️ No FCI prices found.")
            return pd.DataFrame()
        except Exception as e:
            print(f"Error fetching FCI prices: {e}")
            return pd.DataFrame()
    
    def _create_mock_fci_prices(self, start_date=None, end_date=None):
        """Create mock FCI prices for demo/testing"""
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        
        # Simulate ~42% TNA FCI (10% more than 32% TNA caución)
        base_vcp = 1000.0
        daily_return = (1 + 0.42) ** (1/365) - 1  # ~0.096% daily
        
        prices = []
        current_vcp = base_vcp
        date_range = pd.date_range(start=start_date, end=end_date + timedelta(days=1), freq='D')
        
        for d in date_range:
            # Skip weekends (FCI prices not published)
            if d.weekday() < 5:
                prices.append({
                    'fecha': d.strftime('%Y-%m-%d'),
                    'vcp': current_vcp
                })
                current_vcp *= (1 + daily_return)
        
        return pd.DataFrame(prices)
    
    def _fetch_fci_balance(self, portfolio_id=None):
        """
        Fetch current FCI balance (cuotapartes × VCP) from fci_transactions.
        Returns total balance in ARS.
        """
        if self.use_mock:
            # Mock: Assume 20M invested at VCP 1000
            return 20_000_000.0
        
        try:
            # Get transactions for portfolio
            query = self.supabase.table('fci_transactions').select('*')
            
            if self.user_id:
                query = query.eq('user_id', self.user_id)
            if portfolio_id and portfolio_id != 'all':
                query = query.eq('portfolio_id', portfolio_id)
            
            response = query.execute()
            
            if not response.data or len(response.data) == 0:
                return 0.0
            
            df = pd.DataFrame(response.data)
            
            # Calculate net cuotapartes per FCI
            total_balance = 0.0
            fci_ids = df['fci_id'].unique()
            
            for fci_id in fci_ids:
                fci_txs = df[df['fci_id'] == fci_id]
                
                cuotapartes = 0.0
                for _, tx in fci_txs.iterrows():
                    if tx['tipo'] == 'SUBSCRIPTION':
                        cuotapartes += float(tx['cuotapartes'])
                    elif tx['tipo'] == 'REDEMPTION':
                        cuotapartes -= float(tx['cuotapartes'])
                
                # Get latest VCP for this FCI
                latest = self.supabase.table('fci_prices').select('vcp').eq('fci_id', fci_id).order('fecha', desc=True).limit(1).execute()
                if latest.data and len(latest.data) > 0:
                    vcp = float(latest.data[0]['vcp'])
                    total_balance += cuotapartes * vcp
            
            return total_balance
        except Exception as e:
            print(f"Error fetching FCI balance: {e}")
            return 0.0
    
    def get_available_fcis(self, portfolio_id=None):
        """Get list of FCIs with transactions for this user/portfolio"""
        if self.use_mock:
            return [{'id': 'mock-fci-1', 'nombre': 'FCI Demo (42% TNA)'}]
        
        try:
            query = self.supabase.table('fci_transactions').select('fci_id, fci_master(id, nombre)')
            
            if self.user_id:
                query = query.eq('user_id', self.user_id)
            if portfolio_id and portfolio_id != 'all':
                query = query.eq('portfolio_id', portfolio_id)
            
            response = query.execute()
            
            if not response.data:
                return []
            
            # Deduplicate FCIs
            seen = set()
            fcis = []
            for row in response.data:
                fci_id = row.get('fci_id')
                if fci_id and fci_id not in seen:
                    seen.add(fci_id)
                    master = row.get('fci_master', {})
                    fcis.append({
                        'id': fci_id,
                        'nombre': master.get('nombre', 'Desconocido')
                    })
            
            return fcis
        except Exception as e:
            print(f"Error fetching FCIs: {e}")
            return []

    def calculate_spread(self, portfolio_id=None, fci_id=None, start_date=None, end_date=None):
        """
        Calculate daily spread between FCI returns and caución costs.
        
        For each day D:
        - caucion_cost[D] = daily interest cost (already calculated)
        - fci_return[D] = C × (vcp[D+1] - vcp[D]) / vcp[D]  (D+1 offset!)
        - spread[D] = fci_return[D] - caucion_cost[D]
        
        ROI is computed over capital_productivo = min(fci_balance, caucion_viva)
        
        Returns: (df_spread, spread_kpis)
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # 1. Get caución daily stats (reuse existing method)
        df_daily, _ = self.calculate_metrics(portfolio_id, start_date, end_date)
        
        if df_daily.empty:
            return pd.DataFrame(), {}
        
        # 2. Fetch FCI prices
        fci_prices = self._fetch_fci_prices(fci_id, start_date, end_date)
        
        if fci_prices.empty:
            return pd.DataFrame(), {}
        
        # Create VCP lookup dict
        vcp_map = dict(zip(fci_prices['fecha'], fci_prices['vcp']))
        
        # 3. Get FCI balance (mark-to-market)
        fci_balance = self._fetch_fci_balance(portfolio_id)
        
        # 4. Calculate daily spread with D+1 offset
        spread_data = []
        
        for _, row in df_daily.iterrows():
            d_str = row['date']
            d = pd.to_datetime(d_str)
            d_plus_1 = (d + timedelta(days=1)).strftime('%Y-%m-%d')
            
            vcp_d = vcp_map.get(d_str)
            vcp_d1 = vcp_map.get(d_plus_1)
            
            # Skip if we don't have both VCPs (weekends, missing data)
            if vcp_d is None or vcp_d1 is None or vcp_d == 0:
                spread_data.append({
                    'date': d_str,
                    'caucion_cost': row['daily_interest_cost'],
                    'fci_return': None,
                    'spread': None,
                    'caucion_viva': row['total_debt'],
                    'fci_balance': fci_balance
                })
                continue
            
            # Calculate FCI daily return
            # fci_return = C × (vcp[D+1] - vcp[D]) / vcp[D]
            fci_daily_return = fci_balance * (vcp_d1 - vcp_d) / vcp_d
            
            # Calculate spread
            caucion_cost = row['daily_interest_cost']
            spread = fci_daily_return - caucion_cost
            
            spread_data.append({
                'date': d_str,
                'caucion_cost': caucion_cost,
                'fci_return': fci_daily_return,
                'spread': spread,
                'caucion_viva': row['total_debt'],
                'fci_balance': fci_balance
            })
        
        df_spread = pd.DataFrame(spread_data)
        
        # Calculate Capital Productivo for ALL rows (used in UI table)
        if not df_spread.empty:
            df_spread['capital_productivo'] = df_spread.apply(
                lambda r: min(r['fci_balance'], r['caucion_viva']) if r['caucion_viva'] > 0 else 0,
                axis=1
            )

            # -----------------------------------------------------------------
            # RISK LAYER: Full Deployment + Optimal Capital
            # -----------------------------------------------------------------
            
            # 1. Full Deployment PnL (Simulation)
            # Assumptions: 
            # - 100% of caucion_viva is deployed in FCI
            # - Spread Rate = FCI Rate - Caucion Rate (implicit in $ terms)
            # But we have daily $ returns. Let's infer rates.
            
            # Rate FCI = fci_return / fci_balance (if balance > 0)
            # Rate Caucion = caucion_cost / caucion_viva (if viva > 0)
            
            # Since fci_return is calculated on fci_balance,
            # fci_daily_rate = fci_return / fci_balance
            
            # Full Deployment Spread $ = (fci_daily_rate * caucion_viva) - caucion_cost
            # = (fci_return / fci_balance * caucion_viva) - caucion_cost
            
            def calc_full_deployment(row):
                if row['fci_balance'] > 0 and row['caucion_viva'] > 0:
                    fci_rate = row['fci_return'] / row['fci_balance']
                    # Potential return if we had deployed ALL debt
                    potential_fci_return = fci_rate * row['caucion_viva']
                    return potential_fci_return - row['caucion_cost']
                return row['spread'] # Fallback to actual if generic data missing

            df_spread['spread_full'] = df_spread.apply(calc_full_deployment, axis=1)
            
            # 2. Optimal Capital (Sizing)
            # Formula: If spread < 0 -> Max_Loss / |Spread_Rate|
            # Spread Rate needed here is (FCI_Rate - Caucion_Rate)
            # Spread $ = Capital * Spread_Rate
            # So Spread_Rate = Spread $ / Capital (Productive)
            
            # But wait, the user definition: "spread_diario = r_FCI - r_caución"
            # And "Capital óptimo = Loss_Max_Diaria / |spread_diario|"
            
            # Let's calculate daily net rate first
            def calc_net_rate(row):
                if row['capital_productivo'] > 0:
                    return row['spread'] / row['capital_productivo']
                return 0.0
            
            df_spread['net_rate'] = df_spread.apply(calc_net_rate, axis=1)

            # Note: Optimal Capital calculation depends on Max Loss which is a UI parameter.
            # We will return the 'net_rate' so UI can compute dynamic Optimal Capital 
            # or we can pass max_loss to this function.
            # Since engine should be stateless regarding UI params, we'll let UI compute 
            # the final scalar or pass it in. 
            # Actually, to plotting historical optimal capital, we need it here.
            # Let's add an optional argument to calculate_spread or just return rates.
            # We'll stick to returning 'net_rate' and let App handle the interactive "Max Loss" math 
            # to be responsive without re-running engine query.
        
        # 5. Calculate KPIs
        df_valid = df_spread.dropna(subset=['spread'])
        
        if df_valid.empty:
            return df_spread, {}
        
        accumulated_spread = df_valid['spread'].sum()
        accumulated_spread_full = df_valid['spread_full'].sum() if 'spread_full' in df_valid.columns else 0
        carry_lost = accumulated_spread_full - accumulated_spread
        
        total_fci_return = df_valid['fci_return'].sum()
        total_caucion_cost = df_valid['caucion_cost'].sum()
        
        # Stats based on capital productivo
        avg_capital_productivo = df_valid['capital_productivo'].mean()
        
        # ROI over capital productivo (annualized)
        days_in_period = len(df_valid)
        if avg_capital_productivo > 0 and days_in_period > 0:
            roi_period = (accumulated_spread / avg_capital_productivo) * 100
            roi_annualized = roi_period * (365 / days_in_period)
        else:
            roi_period = 0.0
            roi_annualized = 0.0
        
        # Positive vs negative days
        positive_days = len(df_valid[df_valid['spread'] > 0])
        negative_days = len(df_valid[df_valid['spread'] < 0])
        
        # Best and worst day
        best_day = df_valid.loc[df_valid['spread'].idxmax()] if not df_valid.empty else None
        worst_day = df_valid.loc[df_valid['spread'].idxmin()] if not df_valid.empty else None
        
        # Latest Day Shortcuts for Signals
        last_day = df_valid.iloc[-1] if not df_valid.empty else None
        last_net_rate = last_day['net_rate'] if last_day is not None else 0
        last_spread = last_day['spread'] if last_day is not None else 0
        
        spread_kpis = {
            'accumulated_spread': accumulated_spread,
            'accumulated_spread_full': accumulated_spread_full,
            'carry_lost': carry_lost,
            'total_fci_return': total_fci_return,
            'total_caucion_cost': total_caucion_cost,
            'avg_capital_productivo': avg_capital_productivo,
            'roi_period': roi_period,
            'roi_annualized': roi_annualized,
            'positive_days': positive_days,
            'negative_days': negative_days,
            'best_day': {'date': best_day['date'], 'spread': best_day['spread']} if best_day is not None else None,
            'worst_day': {'date': worst_day['date'], 'spread': worst_day['spread']} if worst_day is not None else None,
            'days_analyzed': days_in_period,
            'last_net_rate': last_net_rate,
            'last_spread': last_spread,
            'last_capital_productivo': last_day['capital_productivo'] if last_day is not None else 0,
            'last_caucion_viva': last_day['caucion_viva'] if last_day is not None else 0
        }
        
        return df_spread, spread_kpis

    def get_mep_history(self, start_date=None, end_date=None):
        """
        Fetch MEP prices from mep_history table in Supabase.
        Falls back to local JSON file if table is empty or unavailable.
        """
        def filter_by_date_range(series, start_date, end_date):
            """Filter a pandas Series by date range"""
            if series.empty:
                return series
            if start_date:
                start_str = start_date.strftime('%Y-%m-%d')
                series = series[series.index >= start_str]
            if end_date:
                end_str = end_date.strftime('%Y-%m-%d')
                series = series[series.index <= end_str]
            return series

        # Mock mode: use local JSON directly
        if self.use_mock:
            local_data = load_local_mep_history()
            return filter_by_date_range(local_data, start_date, end_date)

        try:
            # Query the correct historical table: 'mep_history' (from migrations/services)
            query = self.supabase.table('mep_history').select('date, price')

            if start_date:
                query = query.gte('date', start_date.strftime('%Y-%m-%d'))
            if end_date:
                query = query.lte('date', end_date.strftime('%Y-%m-%d'))

            response = query.order('date', desc=False).execute()

            if response.data and len(response.data) > 0:
                df = pd.DataFrame(response.data)
                # Return as a series indexed by date for easy mapping in app.py
                return pd.Series(df['price'].values, index=df['date'])

            # Fallback to local JSON if Supabase table is empty
            print("ℹ️ No data in 'mep_history' table, using local JSON fallback...")
            local_data = load_local_mep_history()
            return filter_by_date_range(local_data, start_date, end_date)

        except Exception as e:
            print(f"Error fetching MEP History from Supabase: {e}")
            # Fallback to local JSON on error
            print("ℹ️ Using local JSON fallback...")
            local_data = load_local_mep_history()
            return filter_by_date_range(local_data, start_date, end_date)


