/**
 * Task Filters Component
 * 
 * Provides filtering controls for tasks by pillar, category, and status.
 * Used across all task list pages.
 * 
 * Features:
 * - Pillar/Category dropdown filters
 * - Show/Hide toggles (Completed, NA, Inactive)
 * - Clear all filters button
 * - Active filter indicators
 */

import React, { useMemo } from 'react';
import { useTaskContext } from '../contexts';

interface TaskFiltersProps {
  /** Currently selected pillar */
  selectedPillar: string;
  
  /** Currently selected category */
  selectedCategory: string;
  
  /** Show completed tasks */
  showCompleted: boolean;
  
  /** Show NA (Not Applicable) tasks */
  showNA: boolean;
  
  /** Show inactive tasks */
  showInactive: boolean;
  
  /** Callback when pillar changes */
  onPillarChange: (pillar: string) => void;
  
  /** Callback when category changes */
  onCategoryChange: (category: string) => void;
  
  /** Callback when show completed changes */
  onShowCompletedChange: (show: boolean) => void;
  
  /** Callback when show NA changes */
  onShowNAChange: (show: boolean) => void;
  
  /** Callback when show inactive changes */
  onShowInactiveChange: (show: boolean) => void;
  
  /** Callback to clear all filters */
  onClearFilters?: () => void;
  
  /** Optional CSS classes */
  className?: string;
  
  /** Show inactive toggle (default true) */
  showInactiveToggle?: boolean;
}

/**
 * Task Filters Component
 * Provides comprehensive filtering controls for task lists
 */
const TaskFilters: React.FC<TaskFiltersProps> = ({
  selectedPillar,
  selectedCategory,
  showCompleted,
  showNA,
  showInactive,
  onPillarChange,
  onCategoryChange,
  onShowCompletedChange,
  onShowNAChange,
  onShowInactiveChange,
  onClearFilters,
  className = '',
  showInactiveToggle = true,
}) => {
  const { pillars, categories } = useTaskContext();

  /**
   * Get categories for the selected pillar
   */
  const categoriesForPillar = useMemo(() => {
    if (!selectedPillar) return [];
    
    const pillar = pillars.find(p => p.name === selectedPillar);
    if (!pillar) return [];
    
    return categories.filter(c => c.pillar_id === pillar.id);
  }, [selectedPillar, pillars, categories]);

  /**
   * Handle pillar change
   */
  const handlePillarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPillar = e.target.value;
    onPillarChange(newPillar);
    // Clear category when pillar changes
    if (newPillar === '') {
      onCategoryChange('');
    }
  };

  /**
   * Handle category change
   */
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange(e.target.value);
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = (): boolean => {
    return !!(selectedPillar || selectedCategory || !showCompleted || !showNA || !showInactive);
  };

  /**
   * Handle clear all filters
   */
  const handleClearAll = () => {
    if (onClearFilters) {
      onClearFilters();
    } else {
      onPillarChange('');
      onCategoryChange('');
      onShowCompletedChange(true);
      onShowNAChange(true);
      onShowInactiveChange(false);
    }
  };

  return (
    <div className={`task-filters ${className}`}>
      <div className="filters-row">
        {/* Pillar Filter */}
        <div className="filter-group">
          <label htmlFor="pillar-filter" className="form-label">
            <i className="fas fa-columns me-1"></i>
            Pillar
          </label>
          <select
            id="pillar-filter"
            value={selectedPillar}
            onChange={handlePillarChange}
            className="form-select form-select-sm"
          >
            <option value="">All Pillars</option>
            {pillars.map((pillar) => (
              <option key={pillar.id} value={pillar.name}>
                {pillar.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="filter-group">
          <label htmlFor="category-filter" className="form-label">
            <i className="fas fa-tag me-1"></i>
            Category
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="form-select form-select-sm"
            disabled={!selectedPillar}
          >
            <option value="">All Categories</option>
            {categoriesForPillar.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Toggles */}
        <div className="filter-group toggles">
          <label className="form-label">Display Options</label>
          <div className="toggle-buttons">
            <div className="form-check form-check-inline">
              <input
                type="checkbox"
                id="show-completed"
                checked={showCompleted}
                onChange={(e) => onShowCompletedChange(e.target.checked)}
                className="form-check-input"
              />
              <label htmlFor="show-completed" className="form-check-label">
                <i className="fas fa-check-circle me-1"></i>
                Completed
              </label>
            </div>

            <div className="form-check form-check-inline">
              <input
                type="checkbox"
                id="show-na"
                checked={showNA}
                onChange={(e) => onShowNAChange(e.target.checked)}
                className="form-check-input"
              />
              <label htmlFor="show-na" className="form-check-label">
                <i className="fas fa-ban me-1"></i>
                N/A
              </label>
            </div>

            {showInactiveToggle && (
              <div className="form-check form-check-inline">
                <input
                  type="checkbox"
                  id="show-inactive"
                  checked={showInactive}
                  onChange={(e) => onShowInactiveChange(e.target.checked)}
                  className="form-check-input"
                />
                <label htmlFor="show-inactive" className="form-check-label">
                  <i className="fas fa-eye-slash me-1"></i>
                  Inactive
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters() && (
          <div className="filter-group">
            <button
              onClick={handleClearAll}
              className="btn btn-sm btn-outline-secondary mt-4"
              title="Clear all filters"
            >
              <i className="fas fa-times me-1"></i>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters() && (
        <div className="active-filters mt-2">
          <small className="text-muted">
            <strong>Active filters:</strong>
            {selectedPillar && <span className="badge bg-info ms-1">{selectedPillar}</span>}
            {selectedCategory && <span className="badge bg-info ms-1">{selectedCategory}</span>}
            {!showCompleted && <span className="badge bg-secondary ms-1">Hide Completed</span>}
            {!showNA && <span className="badge bg-secondary ms-1">Hide N/A</span>}
            {showInactive && <span className="badge bg-warning ms-1">Show Inactive</span>}
          </small>
        </div>
      )}
    </div>
  );
};

export default TaskFilters;
