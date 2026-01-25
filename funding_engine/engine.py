import pandas as pd
import numpy as np
import os
from datetime import date, datetime, timedelta
import uuid

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


def create_mock_fci_data():
    """Creates mock FCI data for demo/testing"""
    start_date = date.today() - timedelta(days=30)
    
    # VCP History (40% TNA growth)
    vcp_data = []
    curr = start_date
    vcp = 100.0
    daily_rate = 0.40 / 365
    while curr <= date.today():
        vcp_data.append({'fecha': curr.isoformat(), 'vcp': vcp, 'fci_id': 1})
        vcp *= (1 + daily_rate)
        curr += timedelta(days=1)
    
    precios = pd.DataFrame(vcp_data)
    
    # Movements
    movimientos = pd.DataFrame([
        {
            'fci_id': 1,
            'fecha': datetime.combine(start_date, datetime.min.time()).isoformat(),
            'tipo': 'SUSCRIPCION',
            'monto': 20_000_000.0,
            'cuotas': 20_000_000.0 / 100.0,
            'motivo': 'funding_caucion'
        },
        {
            'fci_id': 1,
            'fecha': datetime.combine(date.today() - timedelta(days=5), datetime.min.time()).isoformat(),
            'tipo': 'RESCATE',
            'monto': 2_000_000.0,
            'cuotas': 2_000_000.0 / 105.0,
            'motivo': 'retiro_activos'
        }
    ])
    
    return precios, movimientos


class FundingCarryEngine:
    def __init__(self, use_mock=True):
        self.use_mock = use_mock
        self.supabase = None
        
        if not use_mock:
            if not SUPABASE_URL or not SUPABASE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required. Check Streamlit Secrets.")
            
            # Initialize Supabase client
            from supabase import create_client
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    def get_portfolio_ids(self):
        """Returns list of unique portfolio_ids available in Cauciones"""
        if self.use_mock:
            mock_data = create_mock_cauciones()
            return mock_data['portfolio_id'].unique().tolist()
        
        # Query Supabase for distinct portfolio_ids
        try:
            response = self.supabase.table('cauciones').select('portfolio_id').execute()
            if response.data and len(response.data) > 0:
                portfolio_ids = list(set([row['portfolio_id'] for row in response.data if row.get('portfolio_id')]))
                if portfolio_ids:
                    return portfolio_ids
            
            # If no data from real DB (likely RLS issue), fall back to mock for demo
            print("⚠️ No portfolios found in DB (RLS may be blocking). Using mock data for demo.")
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
            if portfolio_id and portfolio_id != 'all':
                query = query.eq('portfolio_id', portfolio_id)
            
            response = query.execute()
            if response.data and len(response.data) > 0:
                return pd.DataFrame(response.data)
            
            # If no data (RLS blocking), use mock for demo
            print("⚠️ No cauciones found in DB. Using mock data for demo.")
            return create_mock_cauciones()
        except Exception as e:
            print(f"Error fetching cauciones: {e}")
            return create_mock_cauciones()

    def calculate_metrics(self, portfolio_id=None, start_date=None, end_date=None):
        """
        Main calculation engine.
        Reconstructs daily state of Debt vs Assets.
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Fetch Data
        cauciones = self._fetch_cauciones(portfolio_id)
        
        # For now, FCI data is always mocked (until we add FCI tables to Supabase)
        precios, movimientos = create_mock_fci_data()
        
        if cauciones.empty:
            return pd.DataFrame(), {}
        
        # Convert date columns
        cauciones['fecha_inicio'] = pd.to_datetime(cauciones['fecha_inicio']).dt.date
        cauciones['fecha_fin'] = pd.to_datetime(cauciones['fecha_fin']).dt.date
        precios['fecha'] = pd.to_datetime(precios['fecha']).dt.date
        movimientos['fecha'] = pd.to_datetime(movimientos['fecha'])
        
        # Process Daily Timeline
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        daily_stats = []
        
        current_holdings = {}
        
        for d in date_range:
            d_date = d.date()
            
            # A. Calculate Debt State
            active_cauciones = cauciones[
                (cauciones['fecha_inicio'] <= d_date) & 
                (cauciones['fecha_fin'] > d_date)
            ]
            
            total_debt = float(active_cauciones['capital'].sum()) if not active_cauciones.empty else 0.0
            daily_interest_cost = 0.0
            weighted_tna = 0.0
            
            if total_debt > 0 and not active_cauciones.empty:
                weighted_tna = np.average(
                    active_cauciones['tna_real'].astype(float), 
                    weights=active_cauciones['capital'].astype(float)
                )
                daily_interest_cost = (total_debt * (weighted_tna / 100)) / 365
            
            # B. Calculate Asset State
            todays_movs = movimientos[movimientos['fecha'].dt.date == d_date]
            for _, mov in todays_movs.iterrows():
                fid = mov['fci_id']
                if mov['tipo'] == 'SUSCRIPCION':
                    current_holdings[fid] = current_holdings.get(fid, 0.0) + mov['cuotas']
                elif mov['tipo'] == 'RESCATE':
                    current_holdings[fid] = current_holdings.get(fid, 0.0) - mov['cuotas']
            
            # Valuation
            total_asset_value = 0.0
            gross_carry_day = 0.0
            
            for fid, quotas in current_holdings.items():
                price_row = precios[(precios['fci_id'] == fid) & (precios['fecha'] == d_date)]
                
                if not price_row.empty:
                    vcp_today = price_row.iloc[0]['vcp']
                    asset_val = quotas * vcp_today
                    total_asset_value += asset_val
                    
                    yesterday = d_date - timedelta(days=1)
                    price_prev = precios[(precios['fci_id'] == fid) & (precios['fecha'] == yesterday)]
                    
                    if not price_prev.empty:
                        vcp_prev = price_prev.iloc[0]['vcp']
                        daily_gain = quotas * (vcp_today - vcp_prev)
                        gross_carry_day += daily_gain
            
            net_carry = gross_carry_day - daily_interest_cost
            utilization = (total_asset_value / total_debt) if total_debt > 0 else 0.0
            
            daily_stats.append({
                'date': d_date,
                'total_debt': total_debt,
                'total_asset_value': total_asset_value,
                'utilization': utilization,
                'weighted_tna': weighted_tna,
                'daily_interest_cost': daily_interest_cost,
                'gross_carry': gross_carry_day,
                'net_carry': net_carry
            })

        df_daily = pd.DataFrame(daily_stats)
        
        # Summary KPIs
        if not df_daily.empty:
            avg_debt = df_daily['total_debt'].mean()
            total_net_carry = df_daily['net_carry'].sum()
            robc_period = (total_net_carry / avg_debt) if avg_debt > 0 else 0.0
            days = (end_date - start_date).days
            robc_annual = robc_period * (365/days) if days > 0 else 0.0
            
            kpis = {
                'avg_debt': avg_debt,
                'avg_assets': df_daily['total_asset_value'].mean(),
                'net_carry_accum': total_net_carry,
                'robc_annual': robc_annual * 100,
                'current_utilization': df_daily.iloc[-1]['utilization'] * 100
            }
        else:
            kpis = {}
            
        return df_daily, kpis
