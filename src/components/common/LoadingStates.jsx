// src/components/common/LoadingStates.jsx
import React, { memo } from 'react';

export const CardSkeleton = memo(() => (
  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-5 border border-slate-700/50">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="h-4 w-24 bg-slate-700 animate-pulse rounded mb-3"></div>
        <div className="h-8 w-32 bg-slate-700 animate-pulse rounded mb-2"></div>
        <div className="h-4 w-20 bg-slate-700 animate-pulse rounded"></div>
      </div>
      <div className="w-12 h-12 bg-slate-700 animate-pulse rounded-xl"></div>
    </div>
  </div>
));

CardSkeleton.displayName = 'CardSkeleton';

export const TableRowSkeleton = memo(({ columns = 8 }) => (
  <tr className="animate-pulse">
    <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 w-12 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-16 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-24 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 w-20 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-700 rounded"></div></td>
    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-12 bg-slate-700 rounded"></div></td>
  </tr>
));

TableRowSkeleton.displayName = 'TableRowSkeleton';

export const TableSkeleton = memo(({ rows = 5, columns = 8 }) => (
  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
    <div className="p-4 border-b border-slate-700/50">
      <div className="flex justify-between items-center">
        <div className="h-6 w-32 bg-slate-700 animate-pulse rounded"></div>
        <div className="h-4 w-16 bg-slate-700 animate-pulse rounded"></div>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1200px]">
        <thead>
          <tr className="bg-slate-900/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticker</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Cant.</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">P. Prom.</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">P. Actual</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Invertido</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Valuación</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Result. Total</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Result. Diario</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">% Diario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {Array(rows).fill(0).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

export const ChartSkeleton = memo(() => (
  <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-xl p-6 border border-slate-700/50">
    <div className="flex justify-between items-center mb-6">
      <div className="h-6 w-48 bg-slate-700 animate-pulse rounded"></div>
    </div>
    <div className="relative mb-6">
      <div className="h-80 bg-slate-800 rounded-lg animate-pulse"></div>
    </div>
    <div className="space-y-3">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-3 px-4 bg-slate-800/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-slate-700 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-slate-700 rounded animate-pulse"></div>
          </div>
          <div className="h-4 w-20 bg-slate-700 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';

export default { CardSkeleton, TableRowSkeleton, TableSkeleton, ChartSkeleton };
