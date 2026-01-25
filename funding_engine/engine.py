import pandas as pd
import numpy as np
import os
from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Caucion, InstrumentoFCI, SerieVCP, MovimientoFCI, ActivoComprado
import uuid

# Configuration
# Prefer standard env vars, fallback to placeholders or VITE_ prefixed if manually injected
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
DB_CONNECTION_STRING = f"postgresql://postgres:[PASSWORD]@{SUPABASE_URL.split('://')[1] if SUPABASE_URL else 'localhost'}:5432/postgres" if SUPABASE_URL else "sqlite:///funding_local.db"

# Mock Data Generator
def create_mock_data(session):
    """Creates initial mock data if database is empty (Local Mode)"""
    if session.query(InstrumentoFCI).count() > 0:
        return

    # 1. Create Mock Cauciones (Simulating existing table)
    # Using a fixed portfolio UUID for demo
    demo_portfolio_id = uuid.uuid4()
    
    start_date = date.today() - timedelta(days=30)
    
    cauciones = []
    # Rolling 7-day cauciones
    curr_date = start_date
    while curr_date < date.today():
        capital = 20_000_000.0 # 20M ARS constant debt
        tna = 0.32 # 32% TNA
        dias = 7
        interes = (capital * tna * dias) / 365
        
        c = Caucion(
            id=uuid.uuid4(),
            portfolio_id=demo_portfolio_id,
            fecha_inicio=curr_date,
            fecha_fin=curr_date + timedelta(days=dias),
            capital=capital,
            monto_devolver=capital + interes,
            interes=interes,
            dias=dias,
            tna_real=tna * 100 # Store as 32.0
        )
        cauciones.append(c)
        curr_date += timedelta(days=dias)
        
    session.add_all(cauciones)
    
    # 2. Create FCI
    fci = InstrumentoFCI(nombre="Galileo Premium A", ticker="GALPA", tipo="money_market")
    session.add(fci)
    session.commit()
    
    # 3. Create Movements
    # Initial subscription matching first caucion
    mov1 = MovimientoFCI(
        fci_id=fci.id,
        fecha=datetime.combine(start_date, datetime.min.time()),
        tipo='SUSCRIPCION',
        monto=20_000_000.0,
        cuotas=20_000_000.0 / 100.0, # Assumed VCP=100
        motivo='funding_caucion'
    )
    
    # Partial redemption 5 days ago (Scenario: Buy Asset)
    redemption_date = date.today() - timedelta(days=5)
    mov2 = MovimientoFCI(
        fci_id=fci.id,
        fecha=datetime.combine(redemption_date, datetime.min.time()),
        tipo='RESCATE',
        monto=2_000_000.0,
        cuotas=2_000_000.0 / 105.0, # Assumed VCP=105
        motivo='retiro_activos'
    )
    session.add_all([mov1, mov2])
    
    # 4. Create VCP History (Steady growth ~40% TNA)
    curr = start_date
    vcp = 100.0
    daily_rate = (0.40) / 365
    while curr <= date.today():
        s = SerieVCP(fci_id=fci.id, fecha=curr, vcp=vcp)
        session.add(s)
        vcp *= (1 + daily_rate)
        curr += timedelta(days=1)
        
    session.commit()
    print("Mock Data Created.")

class FundingCarryEngine:
    def __init__(self, use_mock=True, db_url=None):
        self.use_mock = use_mock
        if use_mock:
            self.engine = create_engine("sqlite:///funding_local.db")
            Base.metadata.create_all(self.engine)
            Session = sessionmaker(bind=self.engine)
            self.session = Session()
            create_mock_data(self.session)
        else:
            # Production connection
            if not db_url:
                raise ValueError("DB URL required for production mode")
            self.engine = create_engine(db_url)
            Session = sessionmaker(bind=self.engine)
            self.session = Session()

    def get_portfolio_ids(self):
        """Returns list of unique portfolio_ids available in Cauciones"""
        # In a real app with 1000s of rows, distinct query is better
        # For prototype, simple query
        rows = self.session.query(Caucion.portfolio_id).distinct().all()
        return [str(r[0]) for r in rows]

    def calculate_metrics(self, portfolio_id=None, start_date=None, end_date=None):
        """
        Main calculation engine.
        Reconstructs daily state of Debt vs Assets.
        """
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=30)
            
        # 1. Fetch Data
        # Filters
        caucion_query = self.session.query(Caucion)
        if portfolio_id and portfolio_id != 'all':
             caucion_query = caucion_query.filter(Caucion.portfolio_id == uuid.UUID(portfolio_id))
        
        cauciones = pd.read_sql(caucion_query.statement, self.session.bind)
        
        # FCIs (Aggregated for pool)
        movimientos = pd.read_sql(self.session.query(MovimientoFCI).statement, self.session.bind)
        precios = pd.read_sql(self.session.query(SerieVCP).statement, self.session.bind)
        
        if cauciones.empty:
            return pd.DataFrame(), {}

        # 2. Process Daily Timeline
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        daily_stats = []
        
        # Sort movements
        movimientos['fecha'] = pd.to_datetime(movimientos['fecha'])
        
        # Pre-process VCPs: Pivot to have columns per FCI
        # Assume single pricing for simplicity in prototype, or use specific FCI logic
        # Here we take average VCP growth for the pool or sum specific logic.
        # Let's do distinct FCI handling if needed, but for "Pool" we sum market values.
        
        current_holdings = {} # {fci_id: cuotas}
        
        for d in date_range:
            d_date = d.date()
            
            # A. Calculate Debt State
            # Active cauciones on this day
            active_cauciones = cauciones[
                (cauciones['fecha_inicio'] <= d_date) & 
                (cauciones['fecha_fin'] > d_date) # Active until maturity (exclusive or inclusive depending on settlement logic, usually inclusive start, exclusive end)
            ]
            
            total_debt = active_cauciones['capital'].sum()
            # Daily interest cost approximation (Capital * TNA / 365)
            # Or sum of daily interest of each operation
            daily_interest_cost = 0.0
            weighted_tna = 0.0
            
            if total_debt > 0:
                # Weighted TNA
                weighted_tna = np.average(active_cauciones['tna_real'], weights=active_cauciones['capital'])
                daily_interest_cost = (total_debt * (weighted_tna / 100)) / 365
            
            # B. Calculate Asset State
            # Process movements up to this day (end of day)
            # Ideally we process movements ON the day.
            
            # Filter movements equal to current day
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
                # Find VCP for this day
                # Try exact match, else bfill/ffill or interpolation
                # In prototype, assume we have data or perform lookup
                price_row = precios[(precios['fci_id'] == fid) & (precios['fecha'] == d_date)]
                
                if not price_row.empty:
                    vcp_today = price_row.iloc[0]['vcp']
                    
                    # Calculate Asset Value
                    asset_val = quotas * vcp_today
                    total_asset_value += asset_val
                    
                    # Calculate Daily Gain (Carry)
                    # Need yesterday's VCP
                    yesterday = d_date - timedelta(days=1)
                    price_prev = precios[(precios['fci_id'] == fid) & (precios['fecha'] == yesterday)]
                    
                    if not price_prev.empty:
                        vcp_prev = price_prev.iloc[0]['vcp']
                        daily_gain = quotas * (vcp_today - vcp_prev)
                        gross_carry_day += daily_gain
            
            # Metrics
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
            # Annualize ROBC (simple)
            days = (end_date - start_date).days
            robc_annual = robc_period * (365/days) if days > 0 else 0.0
            
            kpis = {
                'avg_debt': avg_debt,
                'avg_assets': df_daily['total_asset_value'].mean(),
                'net_carry_accum': total_net_carry,
                'robc_annual': robc_annual * 100, # %
                'current_utilization': df_daily.iloc[-1]['utilization'] * 100
            }
        else:
            kpis = {}
            
        return df_daily, kpis
