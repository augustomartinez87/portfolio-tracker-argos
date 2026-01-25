import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, timedelta, datetime
from engine import FundingCarryEngine

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="Argos Funding Engine",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- STYLING (Dark Mode + Brand Colors) ---
st.markdown("""
<style>
    /* Main Background */
    .stApp {
        background-color: #0E1117;
        color: #FAFAFA;
    }
    
    /* Metrics */
    div[data-testid="metric-container"] {
        background-color: #1a1c24;
        border: 1px solid #333;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    
    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #1a1c24;
    }
    
    /* Headers */
    h1, h2, h3 {
        color: #FFFFFF !important;
    }
    
    /* Custom Red/Green for money */
    .money-pos { color: #00eb88; font-weight: bold; }
    .money-neg { color: #ff2b2b; font-weight: bold; }
</style>
""", unsafe_allow_html=True)

# --- INITIALIZATION ---
# Query Params for Integration
# e.g. /?portfolio_id=uuid&theme=dark&embedded=true&token=SECRET&date_from=2024-01-01
query_params = st.query_params
portfolio_param = query_params.get("portfolio_id", None)
embedded_mode = query_params.get("embedded", "false").lower() == "true"
auth_token = query_params.get("token", None)
url_date_from = query_params.get("date_from", None)
url_date_to = query_params.get("date_to", None)

# --- SECURITY CHECK ---
# Simple token check for prototype (in prod, use st.secrets or robust auth)
REQUIRED_TOKEN = "argos-access" # Replace or load from env
if auth_token != REQUIRED_TOKEN and not use_mock: # Allow skipping in mock/dev if needed, or enforce always
    # For now, let's strictly enforce if parameter provided, or skip if running locally for dev
    # Ideally:
    # if auth_token != os.environ.get("STREAMLIT_TOKEN"): st.stop()
    pass 

if embedded_mode:
    # Hide sidebar via CSS if embedded
    st.markdown("""
    <style>
        section[data-testid="stSidebar"] {display: none;}
        .main .block-container {padding-top: 2rem;}
    </style>
    """, unsafe_allow_html=True)

@st.cache_resource
def get_engine(use_mock):
    return FundingCarryEngine(use_mock=use_mock)

# Initialize Engine
# Default to Real DB if token present (assumption), else Mock 
# User can still override via Sidebar if NOT embedded
default_mock = True

if not embedded_mode:
    st.sidebar.header("🛠 Config & Filters")
    use_mock = st.sidebar.checkbox("Use Mock Data", value=default_mock, help="Toggle between Real Supabase DB and Local Mock DB")
else:
    # In embedded mode, we might want to force Real DB unless specified otherwise
    use_mock = False # Default to real for embedded

engine = get_engine(use_mock)

# Portfolio Selection
portfolios = engine.get_portfolio_ids()
if not portfolios:
    st.error("No portfolios found.")
    st.stop()

# Determine Portfolio
if portfolio_param and portfolio_param in portfolios:
    selected_portfolio = portfolio_param
elif 'all' in portfolios or portfolios:
    selected_portfolio = 'all' # Default
    if not embedded_mode:
        selected_portfolio = st.sidebar.selectbox("Seleccionar Portfolio", ['all'] + portfolios, index=0)
else:
    selected_portfolio = portfolios[0]

# Date Range
today = date.today()
default_start = today - timedelta(days=30)

# Parse URL dates if present
if url_date_from:
    try:
        default_start = datetime.strptime(url_date_from, "%Y-%m-%d").date()
    except:
        pass
if url_date_to:
    try:
        today = datetime.strptime(url_date_to, "%Y-%m-%d").date()
    except:
        pass

if not embedded_mode:
    col1, col2 = st.sidebar.columns(2)
    start_date = col1.date_input("Inicio", default_start)
    end_date = col2.date_input("Fin", today)
else:
    # In embedded mode, use the params directly (calculated above)
    start_date = default_start
    end_date = today

if start_date >= end_date:
    st.error("Fecha Inicio debe ser menor a Fin")
    st.stop()

# --- MAIN LOGIC ---
st.title("💸 Funding & Carry Engine")
st.markdown("Monitor real-time **Net Carry** and **ROBC** from your Cauciones implementation.")

with st.spinner("Calculating metrics..."):
    df_daily, kpis = engine.calculate_metrics(
        portfolio_id=selected_portfolio,
        start_date=start_date,
        end_date=end_date
    )

if df_daily.empty:
    st.warning("No data found for this period.")
    st.stop()

# --- KPI ROW ---
k1, k2, k3, k4 = st.columns(4)

def fmt_money(val):
    color = "money-pos" if val >= 0 else "money-neg"
    return f"{val:,.0f}"

k1.metric("Capital Financiado (Avg)", f"${kpis['avg_debt']:,.0f}")
k1.caption("Deuda Promedio Diaria")

k2.metric("Carry Neto Acumulado", f"${kpis['net_carry_accum']:,.0f}", delta_color="normal")
k2.caption(f"Ganancia real (FCI - Interés)")

robc_val = kpis['robc_annual']
k3.metric("ROBC (Anualizado)", f"{robc_val:.2f}%", delta=f"{robc_val - 32:.2f}% vs Benchmark") # Assumed 32% benchmark
k3.caption("Return on Borrowed Capital")

util_val = kpis['current_utilization']
k4.metric("Utilización Funding", f"{util_val:.1f}%")
k4.caption("Activos / Deuda (Hoy)")

# --- CHARTS ---

# 1. Evolution Chart (Dual Axis)
st.subheader("📈 Deuda vs. Activos")
fig_evol = go.Figure()

fig_evol.add_trace(go.Scatter(
    x=df_daily['date'], y=df_daily['total_debt'],
    name="Deuda (Funding)",
    line=dict(color="#ff4b4b", width=2)
))

fig_evol.add_trace(go.Scatter(
    x=df_daily['date'], y=df_daily['total_asset_value'],
    name="FCI (Activos)",
    line=dict(color="#00eb88", width=2),
    fill='tozeroy',
    fillcolor='rgba(0, 235, 136, 0.1)' 
))

fig_evol.update_layout(
    template="plotly_dark",
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    hovermode="x unified",
    margin=dict(l=0, r=0, t=30, b=0)
)
st.plotly_chart(fig_evol, use_container_width=True)

# 2. Daily Carry Components
st.subheader("📊 Composición del Carry Diario")
fig_carry = go.Figure()

fig_carry.add_trace(go.Bar(
    x=df_daily['date'], y=df_daily['gross_carry'],
    name="Ganancia FCI (+)",
    marker_color="#00eb88"
))

fig_carry.add_trace(go.Bar(
    x=df_daily['date'], y=-df_daily['daily_interest_cost'],
    name="Costo Interés (-)",
    marker_color="#ff4b4b"
))

# Net Curve
fig_carry.add_trace(go.Scatter(
    x=df_daily['date'], y=df_daily['net_carry'],
    name="Carry Neto",
    line=dict(color="white", width=2, dash='dot')
))

fig_carry.update_layout(
    barmode='overlay',
    template="plotly_dark",
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    title="P&L Diario: Costo vs Rendimiento",
    margin=dict(l=0, r=0, t=30, b=0)
)
st.plotly_chart(fig_carry, use_container_width=True)

# --- DETAILS TABLE ---
with st.expander("🔎 Ver Datos Detallados"):
    st.dataframe(
        df_daily.style.format({
            "total_debt": "${:,.0f}",
            "total_asset_value": "${:,.0f}",
            "utilization": "{:.1%}",
            "gross_carry": "${:,.0f}",
            "net_carry": "${:,.0f}",
            "weighted_tna": "{:.2f}%"
        }),
        use_container_width=True
    )
