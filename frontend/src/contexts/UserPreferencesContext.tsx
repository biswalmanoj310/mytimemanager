/**
 * User Preferences Context Provider
 * 
 * Manages UI state, user preferences, and navigation state.
 * This includes active tab, selected dates, filters, and display preferences.
 * 
 * Used by: All pages for consistent UI state management
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { formatDateForInput } from '../utils/dateHelpers';

// Tab types
export type TabType = 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'yearly' 
  | 'onetime' 
  | 'projects' 
  | 'misc' 
  | 'habits' 
  | 'wishes'
  | 'today'
  | 'goals';

// Hierarchy order type
export interface HierarchyOrder {
  [key: string]: number; // e.g., "Hard Work|Office-Tasks": 1
}

// Task name order type
export interface TaskNameOrder {
  [taskName: string]: number; // e.g., "Email": 1
}

interface UserPreferencesContextValue {
  // Navigation state
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  
  // Date selection (for time tracking tabs)
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedDateString: string; // Formatted as YYYY-MM-DD
  
  // Filters
  selectedPillar: string;
  setSelectedPillar: (pillar: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  clearFilters: () => void;
  
  // Display preferences
  showCompleted: boolean;
  setShowCompleted: (show: boolean) => void;
  showNA: boolean;
  setShowNA: (show: boolean) => void;
  showInactive: boolean;
  setShowInactive: (show: boolean) => void;
  
  // Hierarchy and sorting preferences (user-specific)
  hierarchyOrder: HierarchyOrder;
  setHierarchyOrder: (order: HierarchyOrder) => void;
  taskNameOrder: TaskNameOrder;
  setTaskNameOrder: (order: TaskNameOrder) => void;
  
  // View preferences
  expandedGroups: Set<string>;
  toggleGroup: (groupKey: string) => void;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
  
  // Persistence
  loadPreferences: () => void;
  savePreferences: () => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | undefined>(undefined);

interface UserPreferencesProviderProps {
  children: ReactNode;
}

// Local storage keys
const STORAGE_KEYS = {
  ACTIVE_TAB: 'userPrefs_activeTab',
  SELECTED_PILLAR: 'userPrefs_selectedPillar',
  SELECTED_CATEGORY: 'userPrefs_selectedCategory',
  SHOW_COMPLETED: 'userPrefs_showCompleted',
  SHOW_NA: 'userPrefs_showNA',
  SHOW_INACTIVE: 'userPrefs_showInactive',
  HIERARCHY_ORDER: 'userPrefs_hierarchyOrder',
  TASK_NAME_ORDER: 'userPrefs_taskNameOrder',
  EXPANDED_GROUPS: 'userPrefs_expandedGroups',
};

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  // Navigation state
  const [activeTab, setActiveTabState] = useState<TabType>('daily');
  
  // Date selection
  const [selectedDate, setSelectedDateState] = useState<Date>(new Date());
  const selectedDateString = formatDateForInput(selectedDate);
  
  // Filters
  const [selectedPillar, setSelectedPillarState] = useState<string>('');
  const [selectedCategory, setSelectedCategoryState] = useState<string>('');
  
  // Display preferences
  const [showCompleted, setShowCompletedState] = useState<boolean>(true);
  const [showNA, setShowNAState] = useState<boolean>(true);
  const [showInactive, setShowInactiveState] = useState<boolean>(false);
  
  // Hierarchy and sorting preferences
  const [hierarchyOrder, setHierarchyOrderState] = useState<HierarchyOrder>({});
  const [taskNameOrder, setTaskNameOrderState] = useState<TaskNameOrder>({});
  
  // View preferences
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  /**
   * Load preferences from localStorage
   */
  const loadPreferences = useCallback(() => {
    try {
      // Load active tab
      const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      if (savedTab) setActiveTabState(savedTab as TabType);
      
      // Load filters
      const savedPillar = localStorage.getItem(STORAGE_KEYS.SELECTED_PILLAR);
      if (savedPillar) setSelectedPillarState(savedPillar);
      
      const savedCategory = localStorage.getItem(STORAGE_KEYS.SELECTED_CATEGORY);
      if (savedCategory) setSelectedCategoryState(savedCategory);
      
      // Load display preferences
      const savedShowCompleted = localStorage.getItem(STORAGE_KEYS.SHOW_COMPLETED);
      if (savedShowCompleted !== null) setShowCompletedState(savedShowCompleted === 'true');
      
      const savedShowNA = localStorage.getItem(STORAGE_KEYS.SHOW_NA);
      if (savedShowNA !== null) setShowNAState(savedShowNA === 'true');
      
      const savedShowInactive = localStorage.getItem(STORAGE_KEYS.SHOW_INACTIVE);
      if (savedShowInactive !== null) setShowInactiveState(savedShowInactive === 'true');
      
      // Load hierarchy and sorting
      const savedHierarchyOrder = localStorage.getItem(STORAGE_KEYS.HIERARCHY_ORDER);
      if (savedHierarchyOrder) {
        setHierarchyOrderState(JSON.parse(savedHierarchyOrder));
      }
      
      const savedTaskNameOrder = localStorage.getItem(STORAGE_KEYS.TASK_NAME_ORDER);
      if (savedTaskNameOrder) {
        setTaskNameOrderState(JSON.parse(savedTaskNameOrder));
      }
      
      // Load expanded groups
      const savedExpandedGroups = localStorage.getItem(STORAGE_KEYS.EXPANDED_GROUPS);
      if (savedExpandedGroups) {
        setExpandedGroups(new Set(JSON.parse(savedExpandedGroups)));
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  }, []);

  /**
   * Save preferences to localStorage
   */
  const savePreferences = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
      localStorage.setItem(STORAGE_KEYS.SELECTED_PILLAR, selectedPillar);
      localStorage.setItem(STORAGE_KEYS.SELECTED_CATEGORY, selectedCategory);
      localStorage.setItem(STORAGE_KEYS.SHOW_COMPLETED, String(showCompleted));
      localStorage.setItem(STORAGE_KEYS.SHOW_NA, String(showNA));
      localStorage.setItem(STORAGE_KEYS.SHOW_INACTIVE, String(showInactive));
      localStorage.setItem(STORAGE_KEYS.HIERARCHY_ORDER, JSON.stringify(hierarchyOrder));
      localStorage.setItem(STORAGE_KEYS.TASK_NAME_ORDER, JSON.stringify(taskNameOrder));
      localStorage.setItem(STORAGE_KEYS.EXPANDED_GROUPS, JSON.stringify(Array.from(expandedGroups)));
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  }, [activeTab, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder, expandedGroups]);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Auto-save preferences when they change
  useEffect(() => {
    savePreferences();
  }, [activeTab, selectedPillar, selectedCategory, showCompleted, showNA, showInactive, hierarchyOrder, taskNameOrder, expandedGroups, savePreferences]);

  /**
   * Set active tab with persistence
   */
  const setActiveTab = useCallback((tab: TabType) => {
    setActiveTabState(tab);
  }, []);

  /**
   * Set selected date
   */
  const setSelectedDate = useCallback((date: Date) => {
    setSelectedDateState(date);
  }, []);

  /**
   * Set selected pillar with persistence
   */
  const setSelectedPillar = useCallback((pillar: string) => {
    setSelectedPillarState(pillar);
    // Clear category when pillar changes
    if (pillar === '') {
      setSelectedCategoryState('');
    }
  }, []);

  /**
   * Set selected category with persistence
   */
  const setSelectedCategory = useCallback((category: string) => {
    setSelectedCategoryState(category);
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setSelectedPillarState('');
    setSelectedCategoryState('');
  }, []);

  /**
   * Set show completed preference
   */
  const setShowCompleted = useCallback((show: boolean) => {
    setShowCompletedState(show);
  }, []);

  /**
   * Set show NA preference
   */
  const setShowNA = useCallback((show: boolean) => {
    setShowNAState(show);
  }, []);

  /**
   * Set show inactive preference
   */
  const setShowInactive = useCallback((show: boolean) => {
    setShowInactiveState(show);
  }, []);

  /**
   * Set hierarchy order
   */
  const setHierarchyOrder = useCallback((order: HierarchyOrder) => {
    setHierarchyOrderState(order);
  }, []);

  /**
   * Set task name order
   */
  const setTaskNameOrder = useCallback((order: TaskNameOrder) => {
    setTaskNameOrderState(order);
  }, []);

  /**
   * Toggle a group's expanded state
   */
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);

  /**
   * Expand all groups
   */
  const expandAllGroups = useCallback(() => {
    // This will be populated with actual group keys when rendering
    // For now, just clear the set (groups are expanded by default)
    setExpandedGroups(new Set());
  }, []);

  /**
   * Collapse all groups
   */
  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set(['__COLLAPSE_ALL__']));
  }, []);

  const value: UserPreferencesContextValue = {
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    selectedDateString,
    selectedPillar,
    setSelectedPillar,
    selectedCategory,
    setSelectedCategory,
    clearFilters,
    showCompleted,
    setShowCompleted,
    showNA,
    setShowNA,
    showInactive,
    setShowInactive,
    hierarchyOrder,
    setHierarchyOrder,
    taskNameOrder,
    setTaskNameOrder,
    expandedGroups,
    toggleGroup,
    expandAllGroups,
    collapseAllGroups,
    loadPreferences,
    savePreferences,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

/**
 * Hook to use User Preferences Context
 * Must be used within UserPreferencesProvider
 */
export const useUserPreferencesContext = (): UserPreferencesContextValue => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferencesContext must be used within a UserPreferencesProvider');
  }
  return context;
};

export default UserPreferencesContext;
