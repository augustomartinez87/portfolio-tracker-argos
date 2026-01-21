import React, { memo } from 'react';

const Skeleton = memo(({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-slate-700/50 rounded-custom ${className}`} />
  );
});

Skeleton.displayName = 'Skeleton';

export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={`bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-custom p-6 border border-slate-700/50 ${className}`}>
      <Skeleton className="h-4 w-1/4 mb-4" />
      <Skeleton className="h-8 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
};

export const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-custom border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <Skeleton className="h-6 w-1/4 mb-2" />
        <Skeleton className="h-4 w-1/6" />
      </div>
      <div className="p-4 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24 flex-1" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const SkeletonChart = () => {
  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-custom p-6 border border-slate-700/50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
      <Skeleton className="h-96 w-full rounded-custom" />
      <div className="grid grid-cols-4 gap-4 mt-6">
        <Skeleton className="h-20 rounded-custom" />
        <Skeleton className="h-20 rounded-custom" />
        <Skeleton className="h-20 rounded-custom" />
        <Skeleton className="h-20 rounded-custom" />
      </div>
    </div>
  );
};

export default Skeleton;
