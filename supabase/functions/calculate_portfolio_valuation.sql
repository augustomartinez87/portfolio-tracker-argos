-- Prototype: Server-side Portfolio Valuation
-- This function aims to replace the client-side O(N) calculation for large portfolios.
-- It can be triggered via RPC or used in a Materialized View.

CREATE OR REPLACE FUNCTION calculate_portfolio_valuation(p_portfolio_id UUID, p_mep_rate DECIMAL)
RETURNS TABLE (
    ticker TEXT,
    quantity DECIMAL,
    avg_price DECIMAL,
    total_cost DECIMAL,
    total_cost_usd DECIMAL,
    valuation DECIMAL,
    valuation_usd DECIMAL,
    pnl DECIMAL,
    pnl_usd DECIMAL
) LANGUAGE plpgsql AS $$
DECLARE
    r_trade RECORD;
    t_positions JSONB := '{}'::JSONB;
    v_ticker TEXT;
    v_qty DECIMAL;
    v_price DECIMAL;
    v_type TEXT;
    v_date DATE;
    v_hist_mep DECIMAL;
    
    -- Temp vars for position tracking
    curr_qty DECIMAL;
    curr_cost DECIMAL;
    curr_cost_usd DECIMAL;
    
BEGIN
    -- Iterate correctly ordered trades
    FOR r_trade IN
        SELECT ticker, quantity, price, trade_type, trade_date 
        FROM trades 
        WHERE portfolio_id = p_portfolio_id
        ORDER BY trade_date ASC
    LOOP
        v_ticker := r_trade.ticker;
        v_qty := r_trade.quantity;
        v_price := r_trade.price;
        v_type := r_trade.trade_type;
        v_date := r_trade.trade_date;

        -- Initialize if new
        IF NOT (t_positions ? v_ticker) THEN
             t_positions := jsonb_set(t_positions, ARRAY[v_ticker], '{"q": 0, "c": 0, "cu": 0}'::JSONB);
        END IF;

        curr_qty := (t_positions->v_ticker->>'q')::DECIMAL;
        curr_cost := (t_positions->v_ticker->>'c')::DECIMAL;
        curr_cost_usd := (t_positions->v_ticker->>'cu')::DECIMAL;

        IF v_type = 'buy' THEN
            -- Lookup Historical MEP (approximate logic for SQL prototype)
            -- In prod this would use a joined table or optimized function
            SELECT price INTO v_hist_mep FROM mep_history WHERE date <= v_date ORDER BY date DESC LIMIT 1;
            IF v_hist_mep IS NULL THEN v_hist_mep := p_mep_rate; END IF; -- Fallback

            curr_qty := curr_qty + v_qty;
            curr_cost := curr_cost + (v_qty * v_price);
            curr_cost_usd := curr_cost_usd + ((v_qty * v_price) / v_hist_mep);

        ELSIF v_type = 'sell' THEN
            -- Weighted Average Reduction
            IF curr_qty > 0 THEN
                curr_cost := curr_cost - (curr_cost * (v_qty / curr_qty));
                curr_cost_usd := curr_cost_usd - (curr_cost_usd * (v_qty / curr_qty));
                curr_qty := curr_qty - v_qty;
            END IF;
        END IF;

        -- Update JSONB state
        t_positions := jsonb_set(t_positions, ARRAY[v_ticker], 
            jsonb_build_object('q', curr_qty, 'c', curr_cost, 'cu', curr_cost_usd));
    END LOOP;

    -- Return formatted set
    RETURN QUERY
    SELECT 
        key as ticker, 
        (value->>'q')::DECIMAL as quantity,
        CASE WHEN (value->>'q')::DECIMAL > 0 THEN (value->>'c')::DECIMAL / (value->>'q')::DECIMAL ELSE 0 END as avg_price,
        (value->>'c')::DECIMAL as total_cost,
        (value->>'cu')::DECIMAL as total_cost_usd,
        0.0 as valuation, -- Requires live price join
        0.0 as valuation_usd, -- requires live price join
        0.0 as pnl,
        0.0 as pnl_usd
    FROM jsonb_each(t_positions)
    WHERE (value->>'q')::DECIMAL > 0.0001; 
END;
$$;
