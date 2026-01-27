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
    initial_sidebar_state="collapsed"
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
query_params = st.query_params
portfolio_param = query_params.get("portfolio_id", None)
embedded_mode = query_params.get("embedded", "false").lower() == "true"
auth_token = query_params.get("token", None)
url_date_from = query_params.get("date_from", None)
url_date_to = query_params.get("date_to", None)
user_id_param = query_params.get("user_id", None)  # User ID for RLS bypass

if embedded_mode:
    # Adjust layout for iframe but keep sidebar accessible
    st.markdown("""
    <style>
        .main .block-container {padding-top: 1rem;}
    </style>
    """, unsafe_allow_html=True)

# 1. Determine MOCK State FIRST
default_mock = True

if not embedded_mode:
    st.sidebar.header("🛠 Config & Filters")
    use_mock = st.sidebar.checkbox("Use Mock Data", value=default_mock, help="Toggle between Real Supabase DB and Local Mock DB")
else:
    # In embedded mode, default to Real DB.
    use_mock = False 

# 2. SECURITY CHECK
REQUIRED_TOKEN = "argos-access" 
if auth_token != REQUIRED_TOKEN and not use_mock: 
    st.error("⛔ Acceso Denegado: Token inválido.")
    st.stop()

# @st.cache_resource  <-- Disabled to prevent signature collision during dev
def get_engine(use_mock, _user_id=None):
    return FundingCarryEngine(use_mock=use_mock, user_id=_user_id)

engine = get_engine(use_mock, user_id_param)

# Portfolio Selection
portfolios = engine.get_portfolio_ids()
if not portfolios:
    st.error("No portfolios found.")
    st.stop()

# Determine Portfolio
if portfolio_param and portfolio_param in portfolios:
    selected_portfolio = portfolio_param
elif 'all' in portfolios or portfolios:
    selected_portfolio = 'all'
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

# Date Range Controls (Always Visible in Sidebar)
st.sidebar.header("📅 Rango de Fechas")
col1, col2 = st.sidebar.columns(2)
start_date = col1.date_input("Inicio", default_start)
end_date = col2.date_input("Fin", today)

if start_date >= end_date:
    st.error("Fecha Inicio debe ser menor a Fin")
    st.stop()

# --- MAIN LOGIC ---
st.title("💸 Funding & Carry Engine")
st.markdown("Monitoreo de **Costo de Financiamiento** y **Carry Trade** de tus Cauciones Tomadoras.")

with st.spinner("Calculando métricas..."):
    df_daily, kpis = engine.calculate_metrics(
        portfolio_id=selected_portfolio,
        start_date=start_date,
        end_date=end_date
    )

if df_daily.empty:
    st.warning("No hay datos para este período.")
    st.stop()

# --- KPI ROW ---
k1, k2, k3, k4 = st.columns(4)

avg_debt = kpis.get('avg_debt', 0)
total_interest = kpis.get('total_interest', 0)
avg_tna = kpis.get('avg_tna', 0)
current_debt = kpis.get('current_debt', 0)

k1.metric("Capital Financiado (Avg)", f"${avg_debt:,.0f}")
k1.caption("Deuda Promedio Diaria")

k2.metric("Costo Interés (Período)", f"${total_interest:,.0f}")
k2.caption(f"Interés acumulado ({(end_date - start_date).days} días)")

k3.metric("TNA Promedio Ponderada", f"{avg_tna:.2f}%")
k3.caption("Costo del Funding")

k4.metric("Deuda Actual", f"${current_debt:,.0f}")
k4.caption("Capital activo hoy")

# --- CHARTS ---

# 1. Debt Evolution Chart
st.subheader("📈 Evolución del Capital Financiado")
fig_debt = go.Figure()

fig_debt.add_trace(go.Scatter(
    x=df_daily['date'], y=df_daily['total_debt'],
    name="Capital Financiado",
    line=dict(color="#ff4b4b", width=2),
    fill='tozeroy',
    fillcolor='rgba(255, 75, 75, 0.1)'
))

fig_debt.update_layout(
    template="plotly_dark",
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    hovermode="x unified",
    margin=dict(l=0, r=0, t=30, b=0),
    yaxis_title="ARS",
)
st.plotly_chart(fig_debt, use_container_width=True)

# 2. Daily Interest Cost
st.subheader("📊 Costo de Interés Diario")
fig_interest = go.Figure()

fig_interest.add_trace(go.Bar(
    x=df_daily['date'], y=df_daily['daily_interest_cost'],
    name="Costo Interés",
    marker_color="#ff4b4b"
))

# Add TNA line on secondary axis
fig_interest.add_trace(go.Scatter(
    x=df_daily['date'], y=df_daily['weighted_tna'],
    name="TNA (%)",
    line=dict(color="#00eb88", width=2, dash='dot'),
    yaxis="y2"
))

fig_interest.update_layout(
    template="plotly_dark",
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    margin=dict(l=0, r=0, t=30, b=0),
    yaxis_title="Interés Diario (ARS)",
    yaxis2=dict(
        title="TNA (%)",
        overlaying="y",
        side="right"
    )
)
st.plotly_chart(fig_interest, use_container_width=True)

# --- DETAILS TABLE ---
with st.expander("🔎 Ver Datos Detallados"):
    st.dataframe(
        df_daily.style.format({
            "total_debt": "${:,.0f}",
            "daily_interest_cost": "${:,.0f}",
            "weighted_tna": "{:.2f}%"
        }),
        use_container_width=True
    )

# =============================================================================
# CARRY TRADE / SPREAD SECTION
# =============================================================================
st.divider()
st.header("📊 Carry Trade – Spread FCI vs Caución")
st.markdown("""
Este módulo calcula el **spread diario** entre los rendimientos del FCI y el costo de las cauciones.
- ⚠️ Se aplica un **offset D+1** en el VCP del FCI para reflejar el delay real de publicación.
- 💡 ROI calculado sobre **capital productivo** = min(balance FCI, caución viva)
""")

# FCI Selector in Sidebar
st.sidebar.header("📈 Configuración Carry Trade")
available_fcis = engine.get_available_fcis(selected_portfolio)

if not available_fcis:
    st.warning("⚠️ No hay FCIs con transacciones para este portfolio. Agregá suscripciones en el módulo FCI.")
else:
    # FCI Selector
    fci_options = {fci['id']: fci['nombre'] for fci in available_fcis}
    selected_fci_id = st.sidebar.selectbox(
        "Seleccionar FCI",
        options=list(fci_options.keys()),
        format_func=lambda x: fci_options.get(x, x)
    )
    
    # Calculate Spread
    with st.spinner("Calculando spread..."):
        df_spread, spread_kpis = engine.calculate_spread(
            portfolio_id=selected_portfolio,
            fci_id=selected_fci_id,
            start_date=start_date,
            end_date=end_date
        )
    
    if df_spread.empty or not spread_kpis:
        st.warning("No hay datos de spread para este período. Verificá que existan precios de FCI y cauciones en las fechas seleccionadas.")
    else:
        # --- SPREAD KPI ROW ---
        sk1, sk2, sk3, sk4 = st.columns(4)
        
        accumulated_spread = spread_kpis.get('accumulated_spread', 0)
        roi_annualized = spread_kpis.get('roi_annualized', 0)
        positive_days = spread_kpis.get('positive_days', 0)
        negative_days = spread_kpis.get('negative_days', 0)
        avg_capital = spread_kpis.get('avg_capital_productivo', 0)
        
        # Color-coded accumulated spread
        spread_color = "🟢" if accumulated_spread >= 0 else "🔴"
        sk1.metric(
            f"{spread_color} Spread Acumulado", 
            f"${accumulated_spread:,.0f}",
            delta=f"{spread_kpis.get('roi_period', 0):.2f}% período"
        )
        sk1.caption(f"Retorno neto del carry trade")
        
        # ROI Annualized
        roi_color = "🟢" if roi_annualized >= 0 else "🔴"
        sk2.metric(f"{roi_color} ROI TNA", f"{roi_annualized:.1f}%")
        sk2.caption(f"Sobre capital productivo avg ${avg_capital:,.0f}")
        
        # Positive vs Negative Days
        total_days = positive_days + negative_days
        win_rate = (positive_days / total_days * 100) if total_days > 0 else 0
        sk3.metric("Días Positivos", f"{positive_days}/{total_days}")
        sk3.caption(f"Win Rate: {win_rate:.0f}%")
        
        # Best and Worst Day
        best_day = spread_kpis.get('best_day')
        worst_day = spread_kpis.get('worst_day')
        if best_day and worst_day:
            sk4.metric("Mejor Día", f"${best_day['spread']:,.0f}", delta=best_day['date'])
            sk4.caption(f"Peor: ${worst_day['spread']:,.0f} ({worst_day['date']})")
        
        # --- SPREAD CHART ---
        st.subheader("📈 Evolución del Spread Diario")
        
        # Filter to valid data only
        df_chart = df_spread.dropna(subset=['spread'])
        
        if not df_chart.empty:
            fig_spread = go.Figure()
            
            # Spread bars (green positive, red negative)
            colors = ['#00eb88' if x >= 0 else '#ff4b4b' for x in df_chart['spread']]
            
            fig_spread.add_trace(go.Bar(
                x=df_chart['date'],
                y=df_chart['spread'],
                name="Spread $",
                marker_color=colors,
                opacity=0.8
            ))
            
            # FCI Return line
            fig_spread.add_trace(go.Scatter(
                x=df_chart['date'],
                y=df_chart['fci_return'],
                name="Retorno FCI",
                line=dict(color="#00eb88", width=2),
                mode='lines'
            ))
            
            # Caucion Cost line
            fig_spread.add_trace(go.Scatter(
                x=df_chart['date'],
                y=df_chart['caucion_cost'],
                name="Costo Caución",
                line=dict(color="#ff4b4b", width=2, dash='dot'),
                mode='lines'
            ))
            
            fig_spread.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                hovermode="x unified",
                margin=dict(l=0, r=0, t=30, b=0),
                yaxis_title="ARS",
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.02,
                    xanchor="right",
                    x=1
                )
            )
            
            # Add zero line
            fig_spread.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
            
            st.plotly_chart(fig_spread, use_container_width=True)
            
            # Summary Cards
            col1, col2, col3 = st.columns(3)
            col1.metric("📈 Total FCI Return", f"${spread_kpis.get('total_fci_return', 0):,.0f}")
            col2.metric("📉 Total Caución Cost", f"${spread_kpis.get('total_caucion_cost', 0):,.0f}")
            col3.metric("📊 Días Analizados", f"{spread_kpis.get('days_analyzed', 0)}")
        
        # --- SPREAD DETAILS TABLE ---
        with st.expander("🔎 Ver Datos Detallados de Spread"):
            st.dataframe(
                df_spread.style.format({
                    "caucion_cost": "${:,.0f}",
                    "fci_return": "${:,.0f}",
                    "spread": "${:,.0f}",
                    "caucion_viva": "${:,.0f}",
                    "fci_balance": "${:,.0f}"
                }, na_rep="-"),
                use_container_width=True
            )

