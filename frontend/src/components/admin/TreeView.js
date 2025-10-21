import React, { useState } from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PrinterIcon,
  CalendarIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const TreeView = ({ 
  folderStructure, 
  currentPath, 
  onPathChange, 
  expandedFolders, 
  onToggleFolder 
}) => {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Fonction récursive pour rendre l'arbre
  const renderTreeNode = (node, nodeKey, path = '', level = 0) => {
    const isExpanded = expandedFolders.includes(nodeKey);
    const isSelected = currentPath === path;
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    
    const handleToggle = () => {
      if (hasChildren) {
        onToggleFolder(nodeKey);
      }
      onPathChange(path);
    };

    const getNodeIcon = () => {
      if (nodeKey === 'root') {
        return DocumentDuplicateIcon;
      }
      if (nodeKey === 'xerox' || nodeKey === 'roland') {
        return PrinterIcon;
      }
      if (nodeKey === '2025' || /^\d{4}$/.test(nodeKey)) {
        return CalendarIcon;
      }
      if (hasChildren) {
        return isExpanded ? FolderOpenIcon : FolderIcon;
      }
      return FolderIcon;
    };

    const IconComponent = getNodeIcon();

    return (
      <div key={nodeKey}>
        <div
          className={`
            flex items-center px-2 py-1.5 rounded-lg cursor-pointer transition-all
            ${isSelected 
              ? 'bg-blue-100 text-blue-900 border-l-4 border-blue-500' 
              : hoveredNode === nodeKey 
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' 
                : 'text-neutral-700 hover:bg-neutral-50 dark:bg-neutral-900'
            }
          `}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={handleToggle}
          onMouseEnter={() => setHoveredNode(nodeKey)}
          onMouseLeave={() => setHoveredNode(null)}
        >
          {/* Icône d'expansion */}
          {hasChildren && (
            <div className="w-4 h-4 mr-1 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDownIcon className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
              ) : (
                <ChevronRightIcon className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
              )}
            </div>
          )}
          
          {/* Icône du nœud */}
          <IconComponent className={`
            h-4 w-4 mr-2 flex-shrink-0
            ${nodeKey === 'xerox' ? 'text-blue-600' : ''}
            ${nodeKey === 'roland' ? 'text-success-600' : ''}
            ${nodeKey === 'root' ? 'text-purple-600' : ''}
            ${!['xerox', 'roland', 'root'].includes(nodeKey) ? 'text-neutral-500 dark:text-neutral-400' : ''}
          `} />
          
          {/* Nom du nœud */}
          <span className={`
            text-sm font-medium truncate
            ${isSelected ? 'text-blue-900' : 'text-neutral-800 dark:text-neutral-100'}
          `}>
            {node.name}
          </span>
          
          {/* Badge de comptage pour les dossiers avec fichiers */}
          {nodeKey === 'xerox' && (
            <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              3
            </span>
          )}
          {nodeKey === 'roland' && (
            <span className="ml-auto bg-success-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
              2
            </span>
          )}
        </div>
        
        {/* Enfants du nœud */}
        {isExpanded && hasChildren && (
          <div className="transition-all duration-200 ease-in-out">
            {Object.entries(node.children).map(([childKey, childNode]) => 
              renderTreeNode(
                childNode, 
                `${nodeKey}-${childKey}`, 
                path ? `${path}/${childKey}` : `/${childKey}`,
                level + 1
              )
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 px-2">
        Arborescence
      </div>
      
      {/* Rendu de l'arbre à partir de la racine */}
      {folderStructure.root && renderTreeNode(folderStructure.root, 'root', '')}
      
      {/* Raccourcis rapides */}
      <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 px-2">
          Accès rapide
        </div>
        
        <div className="space-y-1">
          <button
            onClick={() => onPathChange('/xerox/2025/octobre')}
            className="w-full flex items-center px-2 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <PrinterIcon className="h-4 w-4 mr-2 text-blue-600" />
            Xerox - Octobre 2025
            <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded">
              Actuel
            </span>
          </button>
          
          <button
            onClick={() => onPathChange('/roland/2025/octobre')}
            className="w-full flex items-center px-2 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-success-50 hover:text-success-700 transition-colors"
          >
            <PrinterIcon className="h-4 w-4 mr-2 text-success-600" />
            Roland - Octobre 2025
            <span className="ml-auto bg-success-100 text-green-800 text-xs px-1.5 py-0.5 rounded">
              Actuel
            </span>
          </button>
          
          <button
            onClick={() => onPathChange('')}
            className="w-full flex items-center px-2 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-colors"
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-2 text-purple-600" />
            Tous les fichiers
          </button>
        </div>
      </div>
      
      {/* Statistiques rapides */}
      <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3 px-2">
          Statistiques
        </div>
        
        <div className="space-y-2 px-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">Fichiers Xerox</span>
            <span className="font-medium text-blue-600">3</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">Fichiers Roland</span>
            <span className="font-medium text-success-600">2</span>
          </div>
          <div className="flex justify-between text-sm border-t border-neutral-200 dark:border-neutral-700 pt-2">
            <span className="text-neutral-600 dark:text-neutral-300">Total</span>
            <span className="font-semibold text-neutral-900 dark:text-white">5</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeView;