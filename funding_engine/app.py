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
# --- MAIN LOGIC ---
# 1. Title at the very top
st.title("Carry Trade – Spread FCI vs Caución")

# 2. Main Calculations (Running in background first)
with st.spinner("Procesando datos del mercado..."):
    # Base Funding Metrics (always needed for context)
    df_daily, kpis = engine.calculate_metrics(
        portfolio_id=selected_portfolio,
        start_date=start_date,
        end_date=end_date
    )

    # FCI Spread Calculation (if configured)
    df_spread = pd.DataFrame()
    spread_kpis = {}
    
    # Check for available FCIs
    available_fcis = engine.get_available_fcis(selected_portfolio)

    # DEFAULT VALUES for Risk Variables (to prevent NameError if bypassed)
    show_usd = False
    max_daily_loss = 10000
    mep_history = pd.Series()
    show_full_deployment = True

    if available_fcis:
        # Default to first FCI if not set
        fci_options = {fci['id']: fci['nombre'] for fci in available_fcis}
        
        # Sidebar control
        st.sidebar.markdown("---")
        st.sidebar.header("📈 Configuración Carry")
        selected_fci_id = st.sidebar.selectbox(
            "Seleccionar FCI para Spread",
            options=list(fci_options.keys()),
            format_func=lambda x: fci_options.get(x, x)
        )

        # Risk & Sizing Controls
        st.sidebar.subheader("🛡️ Control de Riesgo")
        max_daily_loss = st.sidebar.number_input("Max Daily Loss ($)", min_value=0, value=10000, step=1000, format="%d")

        # Withdrawal Threshold
        st.sidebar.markdown("---")
        st.sidebar.subheader("💸 Umbral de Retiro")
        umbral_retiro = st.sidebar.number_input(
            "Monto objetivo ($)",
            min_value=0,
            value=1000000,
            step=100000,
            format="%d",
            help="Monto acumulado de spread para retirar y reinvertir en portfolio principal"
        )

        # USD Toggle (Check availability)
        # Fetch MEP history (fast enough to do here, or cache it)
        try:
             mep_history = engine.get_mep_history(start_date, end_date)
        except:
             mep_history = pd.Series()

        if not mep_history.empty:
            show_usd = st.sidebar.checkbox("Show in USD (MEP)")
        else:
            st.sidebar.caption("🚫 Modo USD no disponible (Faltan datos MEP)")

        show_full_deployment = st.sidebar.checkbox("Mostrar PnL Full Deployment", value=True)
        
        # Calculate Spread
        with st.spinner("Calculando spread..."):
            df_spread, spread_kpis = engine.calculate_spread(
                portfolio_id=selected_portfolio,
                fci_id=selected_fci_id,
                start_date=start_date,
                end_date=end_date
            )

# 3. Main Dashboard Display
if df_spread.empty or not spread_kpis:
    if not available_fcis:
        st.warning("⚠️ No se encontraron suscripciones a FCIs en este portfolio. Agregá operaciones para ver el dashboard.")
    else:
        st.info("👈 Seleccioná un FCI y rango de fechas válido para ver el análisis.")
else:
    # --- MAIN DASHBOARD PROCESSING ---

    # =====================================================================
    # RISK & SIZING LOGIC (APP SIDE)
    # =====================================================================

    # 1. USD Conversion (if enabled)
    currency_label = "$"
    if show_usd and not mep_history.empty:
        currency_label = "USD"
        # Align MEP data
        df_spread['mep'] = df_spread['date'].map(mep_history)
        df_spread['mep'] = df_spread['mep'].ffill().bfill()

        # Convert columns
        cols_to_convert = ['spread', 'spread_full', 'fci_return', 'caucion_cost',
                           'caucion_viva', 'fci_balance', 'capital_productivo']

        for col in cols_to_convert:
            if col in df_spread.columns:
                df_spread[col] = df_spread[col] / df_spread['mep']

        # Recalculate KPIs in USD
        spread_kpis['accumulated_spread'] = df_spread['spread'].sum()
        spread_kpis['accumulated_spread_full'] = df_spread['spread_full'].sum()
        spread_kpis['carry_lost'] = spread_kpis['accumulated_spread_full'] - spread_kpis['accumulated_spread']

        # Loss Max in USD for display/warnings
        current_mep = mep_history.iloc[-1] if not mep_history.empty else 1000
        max_daily_loss_val = max_daily_loss / current_mep
    else:
        max_daily_loss_val = max_daily_loss

    # 2. Traffic Light & Sizing Signal (Latest Day)
    last_spread = spread_kpis.get('last_spread', 0)
    if show_usd: last_spread = df_spread.iloc[-1]['spread']

    last_net_rate = spread_kpis.get('last_net_rate', 0)
    current_caucion = spread_kpis.get('last_caucion_viva', 0)
    if show_usd: current_caucion = df_spread.iloc[-1]['caucion_viva']

    # Traffic Light Logic
    traffic_color = "green"
    traffic_status = "🟢 Carry Positivo"

    if last_spread < 0:
        if abs(last_spread) <= max_daily_loss_val:
            traffic_color = "yellow"
            traffic_status = "🟡 Drawdown (Bajo Riesgo)"
        else:
            traffic_color = "red"
            traffic_status = "🔴 ALERTA: Pérdida > Max Loss"

    # Sizing Signal basado en P75 FCI Mínimo Operativo (NEW!)
    current_fci = spread_kpis.get('last_fci_balance', 0)
    if show_usd: current_fci = df_spread.iloc[-1]['fci_balance']

    # Use P75-based FCI Mínimo Operativo instead of last day value
    fci_minimo_operativo = spread_kpis.get('fci_minimo_operativo', 0)
    ratio_cobertura = spread_kpis.get('ratio_cobertura', 0)
    deficit_fci = spread_kpis.get('deficit_fci', 0)
    p75_traffic_status = spread_kpis.get('traffic_status', 'red')
    p75_traffic_label = spread_kpis.get('traffic_label', '🔴 Déficit Crítico')
    window_days = spread_kpis.get('window_days', 21)

    # USD adjustment for fci_minimo_operativo
    if show_usd and not mep_history.empty:
        current_mep = mep_history.iloc[-1]
        fci_minimo_operativo = fci_minimo_operativo / current_mep
        deficit_fci = deficit_fci / current_mep

    # --- TOP DASHBOARD: TRAFFIC LIGHT & EQUITY ---
    tl_col1, tl_col2 = st.columns([1, 3])

    with tl_col1:
        # Main Traffic Light based on Max Loss (keep existing)
        st.markdown(f"""
        <div style="background-color: #1a1c24; padding: 15px; border-radius: 10px; border: 1px solid #333; text-align: center;">
            <h2 style="margin:0; font-size: 2rem;">{traffic_status.split(' ')[0]}</h2>
            <p style="margin:0; font-weight: bold; color: {traffic_color};">{traffic_status.split(' ', 1)[1]}</p>
            <hr style="margin: 5px 0; border-color: #444;">
            <small>Max Loss: {currency_label}{max_daily_loss_val:,.0f}</small>
        </div>
        """, unsafe_allow_html=True)

        # NEW: Ratio Cobertura Card (P75-based)
        ratio_pct = ratio_cobertura * 100
        bar_width = min(100, max(0, ratio_pct))
        
        if p75_traffic_status == 'green':
            bar_color = '#22c55e'
            text_color = '#22c55e'
        elif p75_traffic_status == 'yellow':
            bar_color = '#fbbf24'
            text_color = '#fbbf24'
        else:
            bar_color = '#ef4444'
            text_color = '#ef4444'
        
        st.markdown(f"""
        <div style="background-color: #1a1c24; padding: 15px; border-radius: 10px; border: 1px solid #333; margin-top: 10px;">
            <h4 style="margin:0 0 10px 0; color: #fff;">📊 Ratio Cobertura <small style="color:#888;">(P75×1.15, {window_days}d)</small></h4>
            
            <div style="text-align: center; margin: 10px 0;">
                <h2 style="margin:0; font-size: 2.5rem; color: {text_color};">{ratio_pct:.0f}%</h2>
                <p style="margin:0; font-size: 0.9rem; color: {text_color};">{p75_traffic_label}</p>
            </div>
            
            <div style="background-color: #333; border-radius: 5px; height: 12px; overflow: hidden; margin: 10px 0;">
                <div style="background: {bar_color}; width: {bar_width}%; height: 100%;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #666;">
                <span>0%</span>
                <span style="color: #ef4444;">85%</span>
                <span style="color: #fbbf24;">100%</span>
                <span style="color: #22c55e;">105%+</span>
            </div>
            
            <hr style="margin: 10px 0; border-color: #444;">
            
            <p style="margin:5px 0; font-size: 0.85rem;">
                <strong>FCI Actual:</strong> {currency_label}{current_fci:,.0f}
            </p>
            <p style="margin:5px 0; font-size: 0.85rem;">
                <strong>FCI Mínimo Op.:</strong> {currency_label}{fci_minimo_operativo:,.0f}
            </p>
            <p style="margin:5px 0; font-size: 0.85rem; color: {text_color};">
                <strong>{'Déficit' if deficit_fci > 0 else 'Exceso'}:</strong> {currency_label}{abs(deficit_fci):,.0f}
            </p>
        </div>
        """, unsafe_allow_html=True)

        # --- WITHDRAWAL THRESHOLD PROGRESS ---
        st.markdown("---")
        pnl_acumulado = spread_kpis['accumulated_spread']

        # Adjust umbral for USD if needed
        umbral_display = umbral_retiro
        if show_usd and not mep_history.empty:
            current_mep = mep_history.iloc[-1]
            umbral_display = umbral_retiro / current_mep

        # Progress calculation
        if umbral_display > 0:
            progreso_pct = min(100, max(0, (pnl_acumulado / umbral_display) * 100))
            faltante = max(0, umbral_display - pnl_acumulado)

            # Days projection based on average daily spread
            days_analyzed = spread_kpis.get('days_analyzed', 1)
            avg_daily_spread = pnl_acumulado / days_analyzed if days_analyzed > 0 else 0

            if avg_daily_spread > 0 and faltante > 0:
                dias_para_umbral = int(faltante / avg_daily_spread)
                proyeccion_text = f"~{dias_para_umbral} días"
            elif pnl_acumulado >= umbral_display:
                proyeccion_text = "Meta alcanzada!"
            else:
                proyeccion_text = "N/A (spread negativo)"

            # Display progress card
            st.markdown(f"""
            <div style="background-color: #1a1c24; padding: 15px; border-radius: 10px; border: 1px solid #333;">
                <h4 style="margin:0 0 10px 0; color: #fbbf24;">💸 Progreso a Retiro</h4>
                <p style="margin:5px 0; font-size: 0.9rem;">
                    Acumulado: <strong>{currency_label}{pnl_acumulado:,.0f}</strong> / {currency_label}{umbral_display:,.0f}
                </p>
                <div style="background-color: #333; border-radius: 5px; height: 20px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #22c55e, #fbbf24); width: {progreso_pct:.1f}%; height: 100%;"></div>
                </div>
                <p style="margin:5px 0; font-size: 0.85rem; color: #888;">
                    {progreso_pct:.1f}% completado
                </p>
                <hr style="margin: 10px 0; border-color: #444;">
                <p style="margin:5px 0;">
                    <strong>Proyección:</strong> {proyeccion_text}
                </p>
                <p style="margin:5px 0; font-size: 0.85rem; color: #888;">
                    Spread diario promedio: {currency_label}{avg_daily_spread:,.0f}
                </p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.info("Configurá un umbral de retiro en el sidebar para ver el progreso.")

    with tl_col2:
        # --- EQUITY CURVE (PnL ACUMULADO) ---
        df_chart = df_spread.dropna(subset=['spread']).copy()
        if not df_chart.empty:
            df_chart['spread_acumulado'] = df_chart['spread'].cumsum()
            if show_full_deployment:
                df_chart['spread_full_acumulado'] = df_chart['spread_full'].cumsum()

            final_pnl = df_chart['spread_acumulado'].iloc[-1]
            pnl_color = "#00eb88" if final_pnl >= 0 else "#ff4b4b"

            st.subheader(f"💰 Equity Curve ({currency_label})")

            fig_equity = go.Figure()

            # Real PnL
            fig_equity.add_trace(go.Scatter(
                x=df_chart['date'],
                y=df_chart['spread_acumulado'],
                name="PnL Real",
                line=dict(color=pnl_color, width=3),
                fill='tozeroy',
                fillcolor=f"rgba({0 if final_pnl >=0 else 255}, {235 if final_pnl >=0 else 75}, {136 if final_pnl >=0 else 75}, 0.1)"
            ))

            # Full Deployment PnL (Optional)
            if show_full_deployment:
                fig_equity.add_trace(go.Scatter(
                    x=df_chart['date'],
                    y=df_chart['spread_full_acumulado'],
                    name="Full Deployment Sim",
                    line=dict(color="#fbbf24", width=2, dash='dash')
                ))

            fig_equity.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                hovermode="x unified",
                margin=dict(l=0, r=0, t=10, b=0),
                yaxis_title=f"PnL Acumulado ({currency_label})",
                height=300,
                legend=dict(orientation="h", y=1.1, x=1, xanchor="right")
            )
            st.plotly_chart(fig_equity, use_container_width=True)

    # Key High-Level Metrics Row
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("PnL Total", f"{currency_label}{spread_kpis['accumulated_spread']:,.0f}")
    k2.metric("TNA Implícita (ROI)", f"{spread_kpis['roi_annualized']:.1f}%")
    k3.metric("Capital Productivo Avg", f"{currency_label}{spread_kpis['avg_capital_productivo']:,.0f}")

    if show_full_deployment:
        carry_lost = spread_kpis.get('carry_lost', 0)
        k4.metric("Carry Perdido", f"{currency_label}{carry_lost:,.0f}", help="Diferencia vs Full Deployment")
    else:
        win_rate = (spread_kpis['positive_days'] / spread_kpis['days_analyzed'] * 100) if spread_kpis['days_analyzed'] > 0 else 0
        k4.metric("Win Rate", f"{win_rate:.0f}%", help=f"{spread_kpis['positive_days']} días pos / {spread_kpis['negative_days']} neg")

    # --- SPREAD DIARIO & BREAKDOWN ---
    col_spread, col_breakdown = st.columns(2)

    with col_spread:
        st.subheader(f"📊 Spread Diario ({currency_label})")
        if 'df_chart' in dir() and not df_chart.empty:
            fig_spread = go.Figure()
            colors = ['#00eb88' if x >= 0 else '#ff4b4b' for x in df_chart['spread']]
            fig_spread.add_trace(go.Bar(
                x=df_chart['date'],
                y=df_chart['spread'],
                marker_color=colors,
                name="Spread"
            ))
            fig_spread.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                margin=dict(l=0, r=0, t=30, b=0),
                height=300,
                showlegend=False
            )
            st.plotly_chart(fig_spread, use_container_width=True)

    with col_breakdown:
        st.subheader("🆚 Breakdown: FCI vs Caución")
        if 'df_chart' in dir() and not df_chart.empty:
            fig_break = go.Figure()
            fig_break.add_trace(go.Scatter(x=df_chart['date'], y=df_chart['fci_return'], name="Ganancia FCI", line=dict(color="#00eb88", width=2)))
            fig_break.add_trace(go.Scatter(x=df_chart['date'], y=df_chart['caucion_cost'], name="Costo Caución", line=dict(color="#ff4b4b", width=2, dash='dot')))
            fig_break.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                hovermode="x unified",
                margin=dict(l=0, r=0, t=30, b=0),
                legend=dict(orientation="h", y=1.1, x=0.5, xanchor="center"),
                height=300
            )
            st.plotly_chart(fig_break, use_container_width=True)

    # --- C. CAPITAL STRUCTURE & BREAKEVEN ---
    st.subheader("⚖️ Estructura de Capital: FCI, Deuda y Punto de Equilibrio")
    if 'df_chart' in dir() and not df_chart.empty:
        fig_cap = go.Figure()

        fig_cap.add_trace(go.Scatter(
            x=df_chart['date'],
            y=df_chart['fci_balance'],
            name="Balance FCI (actual)",
            line=dict(color="#3b82f6", width=2),
            fill='tozeroy',
            fillcolor="rgba(59, 130, 246, 0.1)"
        ))

        fig_cap.add_trace(go.Scatter(
            x=df_chart['date'],
            y=df_chart['caucion_viva'],
            name="Deuda Viva",
            line=dict(color="#ef4444", width=2)
        ))

        # FCI Mínimo (Punto de Equilibrio) Line
        fig_cap.add_trace(go.Scatter(
            x=df_chart['date'],
            y=df_chart['fci_minimo'],
            name="FCI Mínimo (equilibrio)",
            line=dict(color="#22c55e", width=2, dash='dash'),
        ))

        fig_cap.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            hovermode="x unified",
            margin=dict(l=0, r=0, t=30, b=0),
            legend=dict(orientation="h", y=1.1, x=0.5, xanchor="center"),
            height=300
        )
        st.plotly_chart(fig_cap, use_container_width=True)

# =============================================================================
# FUNDING ENGINE METRICS (SECONDARY)
# =============================================================================
st.divider()

if not df_daily.empty:
    with st.expander("📉 Métricas de Financiamiento (Solo Deuda)"):
        k1, k2, k3, k4 = st.columns(4)
        k1.metric("Deuda Promedio", f"${kpis.get('avg_debt', 0):,.0f}")
        k2.metric("Intereses Pagados", f"${kpis.get('total_interest', 0):,.0f}")
        k3.metric("TNA Promedio", f"{kpis.get('avg_tna', 0):.2f}%")
        k4.metric("Deuda Actual", f"${kpis.get('current_debt', 0):,.0f}")
        
        st.subheader("Evolución de Deuda")
        fig_debt = go.Figure()
        fig_debt.add_trace(go.Scatter(
            x=df_daily['date'], y=df_daily['total_debt'],
            name="Deuda Total",
            line=dict(color="#ff4b4b", width=2),
            fill='tozeroy'
        ))
        fig_debt.update_layout(template="plotly_dark", height=300, margin=dict(t=0, b=0, l=0, r=0))
        st.plotly_chart(fig_debt, use_container_width=True)
