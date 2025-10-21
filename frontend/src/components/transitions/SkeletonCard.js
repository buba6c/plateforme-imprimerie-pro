import React from 'react';

const SkeletonCard = ({ type = 'default' }) => {
  if (type === 'delivery') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
        
        <div className="space-y-3 mb-4">
          <div className="flex gap-2">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
          </div>
          <div className="flex gap-2">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-pulse flex items-center gap-4">
        <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
    </div>
  );
};

export const SkeletonGrid = ({ count = 4, type = 'default', columns = 2 }) => {
  const gridClass = columns === 1 ? 'grid grid-cols-1 gap-4' :
                    columns === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' :
                    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

  return (
    <div className={gridClass}>
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} type={type} />
      ))}
    </div>
  );
};

export default SkeletonCard;
