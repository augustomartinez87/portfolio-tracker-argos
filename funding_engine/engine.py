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
                (cauciones['fecha_fin_str'] >= d_str)  # >= includes same-day expiry
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
        
        # Summary KPIs (Debt Only)
        if not df_daily.empty:
            avg_debt = df_daily['total_debt'].mean()
            total_interest = df_daily['daily_interest_cost'].sum()
            avg_tna = df_daily['weighted_tna'].mean()
            current_debt = df_daily.iloc[-1]['total_debt']
            
            kpis = {
                'avg_debt': avg_debt,
                'total_interest': total_interest,
                'avg_tna': avg_tna,
                'current_debt': current_debt,
            }
        else:
            kpis = {}
            
        return df_daily, kpis
