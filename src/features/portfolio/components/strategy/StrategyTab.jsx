import React, { useState, useEffect } from 'react';
import { RebalanceAlerts } from './RebalanceAlerts';
import { TargetAllocation } from './TargetAllocation';
import { TradeJournal } from './TradeJournal';

const TARGETS_KEY = 'portfolio_strategy_targets';
const DEFAULT_TARGETS = { core1: 50, core2: 30 };

export function StrategyTab({ positions, totals }) {
  const [targets, setTargets] = useState(() => {
    try {
      const stored = localStorage.getItem(TARGETS_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_TARGETS;
    } catch {
      return DEFAULT_TARGETS;
    }
  });

  useEffect(() => {
    localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  }, [targets]);

  return (
    <div className="flex-1 overflow-y-auto py-4 pr-1 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-6">
        <RebalanceAlerts positions={positions} totals={totals} targets={targets} />
        <TargetAllocation
          positions={positions}
          totals={totals}
          targets={targets}
          onChangeTargets={setTargets}
        />
        <TradeJournal />
      </div>
    </div>
  );
}
