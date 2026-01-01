/**
 * Time Entries Context Provider
 * 
 * Manages daily time entries and aggregates for all time tracking tabs.
 * Provides centralized state for Daily, Weekly, Monthly, and Yearly tabs.
 * 
 * Used by: Daily, Weekly, Monthly, Yearly tabs
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { api } from '../services/api';

// Time entry interfaces
export interface DailyEntry {
  id: number;
  task_id: number;
  date: string;
  time_spent?: number;
  count?: number;
  notes?: string;
  is_completed: boolean;
  is_na: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyEntry {
  id: number;
  task_id: number;
  week_start_date: string;
  time_spent?: number;
  count?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyEntry {
  id: number;
  task_id: number;
  month_start_date: string;
  time_spent?: number;
  count?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface YearlyEntry {
  id: number;
  task_id: number;
  year: number;
  time_spent?: number;
  count?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OneTimeEntry {
  id: number;
  task_id: number;
  completion_date?: string;
  time_spent?: number;
  count?: number;
  notes?: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

// Task status tracking interfaces
export interface TaskStatus {
  is_completed: boolean;
  is_na: boolean;
  created_at?: string; // When task was added to this tracking view
}

interface TimeEntriesContextValue {
  // Daily entries state
  dailyEntries: DailyEntry[];
  loadingDaily: boolean;
  
  // Weekly entries state (manual weekly entries)
  weeklyEntries: WeeklyEntry[];
  loadingWeekly: boolean;
  
  // Weekly task statuses (which tasks are tracked in weekly view)
  weeklyTaskStatuses: Record<number, TaskStatus>;
  
  // Daily aggregates for weekly view (daily tasks shown in weekly)
  dailyAggregatesWeekly: Record<string, number>; // key: "taskId-dayOfWeek", value: minutes/count
  
  // Monthly entries state (manual monthly entries)
  monthlyEntries: MonthlyEntry[];
  loadingMonthly: boolean;
  
  // Monthly task statuses (which tasks are tracked in monthly view)
  monthlyTaskStatuses: Record<number, TaskStatus>;
  
  // Daily aggregates for monthly view (daily tasks shown in monthly)
  dailyAggregatesMonthly: Record<string, number>; // key: "taskId-day", value: minutes/count
  
  // Yearly entries state
  yearlyEntries: YearlyEntry[];
  loadingYearly: boolean;
  
  // Yearly task statuses (which tasks are tracked in yearly view)
  yearlyTaskStatuses: Record<number, TaskStatus>;
  
  // Monthly aggregates for yearly view (monthly tasks shown in yearly)
  yearlyMonthlyAggregates: Record<string, number>; // key: "taskId-month", value: minutes/count
  
  // One-time entries state
  oneTimeEntries: OneTimeEntry[];
  loadingOneTime: boolean;
  
  error: string | null;

  // Daily operations
  loadDailyEntries: (date: string) => Promise<void>;
  saveDailyEntry: (entry: Partial<DailyEntry>) => Promise<DailyEntry>;
  updateDailyEntry: (entryId: number, updates: Partial<DailyEntry>) => Promise<DailyEntry>;
  deleteDailyEntry: (entryId: number) => Promise<void>;
  
  // Weekly operations
  loadWeeklyEntries: (weekStartDate: string) => Promise<void>;
  saveWeeklyEntry: (entry: Partial<WeeklyEntry>) => Promise<WeeklyEntry>;
  updateWeeklyEntry: (entryId: number, updates: Partial<WeeklyEntry>) => Promise<WeeklyEntry>;
  loadWeeklyTaskStatuses: (weekStartDate: string) => Promise<void>;
  updateWeeklyTaskStatus: (taskId: number, weekStartDate: string, status: Partial<TaskStatus>) => Promise<void>;
  loadDailyAggregatesForWeek: (weekStartDate: string) => Promise<void>;
  
  // Monthly operations
  loadMonthlyEntries: (monthStartDate: string) => Promise<void>;
  saveMonthlyEntry: (entry: Partial<MonthlyEntry>) => Promise<MonthlyEntry>;
  updateMonthlyEntry: (entryId: number, updates: Partial<MonthlyEntry>) => Promise<MonthlyEntry>;
  loadMonthlyTaskStatuses: (monthStartDate: string) => Promise<void>;
  updateMonthlyTaskStatus: (taskId: number, monthStartDate: string, status: Partial<TaskStatus>) => Promise<void>;
  loadDailyAggregatesForMonth: (monthStartDate: string) => Promise<void>;
  
  // Yearly operations
  loadYearlyEntries: (year: number) => Promise<void>;
  saveYearlyEntry: (entry: Partial<YearlyEntry>) => Promise<YearlyEntry>;
  updateYearlyEntry: (entryId: number, updates: Partial<YearlyEntry>) => Promise<YearlyEntry>;
  loadYearlyTaskStatuses: (year: number) => Promise<void>;
  updateYearlyTaskStatus: (taskId: number, year: number, status: Partial<TaskStatus>) => Promise<void>;
  loadMonthlyAggregatesForYear: (year: number) => Promise<void>;
  
  // One-time operations
  loadOneTimeEntries: () => Promise<void>;
  saveOneTimeEntry: (entry: Partial<OneTimeEntry>) => Promise<OneTimeEntry>;
  updateOneTimeEntry: (entryId: number, updates: Partial<OneTimeEntry>) => Promise<OneTimeEntry>;
}

const TimeEntriesContext = createContext<TimeEntriesContextValue | undefined>(undefined);

interface TimeEntriesProviderProps {
  children: ReactNode;
}

export const TimeEntriesProvider: React.FC<TimeEntriesProviderProps> = ({ children }) => {
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyEntry[]>([]);
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyEntry[]>([]);
  const [yearlyEntries, setYearlyEntries] = useState<YearlyEntry[]>([]);
  const [oneTimeEntries, setOneTimeEntries] = useState<OneTimeEntry[]>([]);
  
  // Task status tracking
  const [weeklyTaskStatuses, setWeeklyTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [monthlyTaskStatuses, setMonthlyTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [yearlyTaskStatuses, setYearlyTaskStatuses] = useState<Record<number, TaskStatus>>({});
  
  // Daily aggregates for weekly/monthly views
  const [dailyAggregatesWeekly, setDailyAggregatesWeekly] = useState<Record<string, number>>({});
  const [dailyAggregatesMonthly, setDailyAggregatesMonthly] = useState<Record<string, number>>({});
  
  // Monthly aggregates for yearly view
  const [yearlyMonthlyAggregates, setYearlyMonthlyAggregates] = useState<Record<string, number>>({});
  
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingYearly, setLoadingYearly] = useState(false);
  const [loadingOneTime, setLoadingOneTime] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  // ==================== DAILY ENTRIES ====================
  
  const loadDailyEntries = useCallback(async (date: string) => {
    try {
      setLoadingDaily(true);
      setError(null);
      const data = await api.get<DailyEntry[]>(`/api/daily-entries/?date=${date}`);
      setDailyEntries(data);
    } catch (err: any) {
      console.error('Error loading daily entries:', err);
      setError('Failed to load daily entries');
      throw err;
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  const saveDailyEntry = useCallback(async (entry: Partial<DailyEntry>): Promise<DailyEntry> => {
    try {
      const newEntry = await api.post<DailyEntry>('/api/daily-entries/', entry);
      setDailyEntries((prev) => [...prev, newEntry]);
      return newEntry;
    } catch (err: any) {
      console.error('Error saving daily entry:', err);
      setError('Failed to save daily entry');
      throw err;
    }
  }, []);

  const updateDailyEntry = useCallback(async (entryId: number, updates: Partial<DailyEntry>): Promise<DailyEntry> => {
    try {
      const updatedEntry = await api.put<DailyEntry>(`/api/daily-entries/${entryId}`, updates);
      setDailyEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      );
      return updatedEntry;
    } catch (err: any) {
      console.error('Error updating daily entry:', err);
      setError('Failed to update daily entry');
      throw err;
    }
  }, []);

  const deleteDailyEntry = useCallback(async (entryId: number): Promise<void> => {
    try {
      await api.delete(`/api/daily-entries/${entryId}`);
      setDailyEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (err: any) {
      console.error('Error deleting daily entry:', err);
      setError('Failed to delete daily entry');
      throw err;
    }
  }, []);

  // ==================== WEEKLY ENTRIES ====================

  const loadWeeklyEntries = useCallback(async (weekStartDate: string) => {
    try {
      setLoadingWeekly(true);
      setError(null);
      const data = await api.get<WeeklyEntry[]>(`/api/weekly-entries/?week_start_date=${weekStartDate}`);
      setWeeklyEntries(data);
    } catch (err: any) {
      console.error('Error loading weekly entries:', err);
      setError('Failed to load weekly entries');
      throw err;
    } finally {
      setLoadingWeekly(false);
    }
  }, []);

  const saveWeeklyEntry = useCallback(async (entry: Partial<WeeklyEntry>): Promise<WeeklyEntry> => {
    try {
      const newEntry = await api.post<WeeklyEntry>('/api/weekly-entries/', entry);
      setWeeklyEntries((prev) => [...prev, newEntry]);
      return newEntry;
    } catch (err: any) {
      console.error('Error saving weekly entry:', err);
      setError('Failed to save weekly entry');
      throw err;
    }
  }, []);

  const updateWeeklyEntry = useCallback(async (entryId: number, updates: Partial<WeeklyEntry>): Promise<WeeklyEntry> => {
    try {
      const updatedEntry = await api.put<WeeklyEntry>(`/api/weekly-entries/${entryId}`, updates);
      setWeeklyEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      );
      return updatedEntry;
    } catch (err: any) {
      console.error('Error updating weekly entry:', err);
      setError('Failed to update weekly entry');
      throw err;
    }
  }, []);

  const loadWeeklyTaskStatuses = useCallback(async (weekStartDate: string) => {
    try {
      setError(null);
      const response: any = await api.get(`/api/weekly-time/status/${weekStartDate}`);
      const statusData = Array.isArray(response) ? response : (response.data || []);
      
      const statusMap: Record<number, TaskStatus> = {};
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na
          };
        });
      }
      
      setWeeklyTaskStatuses(statusMap);
    } catch (err: any) {
      console.error('Error loading weekly task statuses:', err);
      setError('Failed to load weekly task statuses');
      setWeeklyTaskStatuses({});
      throw err;
    }
  }, []);

  const updateWeeklyTaskStatus = useCallback(async (taskId: number, weekStartDate: string, status: Partial<TaskStatus>) => {
    try {
      await api.post(`/api/weekly-time/status/${taskId}/${weekStartDate}`, status);
      // Reload statuses after update
      await loadWeeklyTaskStatuses(weekStartDate);
    } catch (err: any) {
      console.error('Error updating weekly task status:', err);
      setError('Failed to update weekly task status');
      throw err;
    }
  }, [loadWeeklyTaskStatuses]);

  const loadDailyAggregatesForWeek = useCallback(async (weekStartDate: string) => {
    try {
      setError(null);
      const response: any = await api.get(`/api/daily-time/entries/week/${weekStartDate}`);
      
      const aggregatesMap: Record<string, number> = {};
      const dailyData = response.data || response;
      
      if (dailyData && typeof dailyData === 'object') {
        Object.entries(dailyData).forEach(([taskId, dayData]: [string, any]) => {
          if (dayData && typeof dayData === 'object') {
            Object.entries(dayData).forEach(([dayOfWeek, minutes]: [string, any]) => {
              const key = `${taskId}-${dayOfWeek}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      setDailyAggregatesWeekly(aggregatesMap);
    } catch (err: any) {
      console.error('Error loading daily aggregates for week:', err);
      setError('Failed to load daily aggregates');
      setDailyAggregatesWeekly({});
      throw err;
    }
  }, []);

  // ==================== MONTHLY ENTRIES ====================

  const loadMonthlyEntries = useCallback(async (monthStartDate: string) => {
    try {
      setLoadingMonthly(true);
      setError(null);
      const data = await api.get<MonthlyEntry[]>(`/api/monthly-entries/?month_start_date=${monthStartDate}`);
      setMonthlyEntries(data);
    } catch (err: any) {
      console.error('Error loading monthly entries:', err);
      setError('Failed to load monthly entries');
      throw err;
    } finally {
      setLoadingMonthly(false);
    }
  }, []);

  const saveMonthlyEntry = useCallback(async (entry: Partial<MonthlyEntry>): Promise<MonthlyEntry> => {
    try {
      const newEntry = await api.post<MonthlyEntry>('/api/monthly-entries/', entry);
      setMonthlyEntries((prev) => [...prev, newEntry]);
      return newEntry;
    } catch (err: any) {
      console.error('Error saving monthly entry:', err);
      setError('Failed to save monthly entry');
      throw err;
    }
  }, []);

  const updateMonthlyEntry = useCallback(async (entryId: number, updates: Partial<MonthlyEntry>): Promise<MonthlyEntry> => {
    try {
      const updatedEntry = await api.put<MonthlyEntry>(`/api/monthly-entries/${entryId}`, updates);
      setMonthlyEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      );
      return updatedEntry;
    } catch (err: any) {
      console.error('Error updating monthly entry:', err);
      setError('Failed to update monthly entry');
      throw err;
    }
  }, []);

  const loadMonthlyTaskStatuses = useCallback(async (monthStartDate: string) => {
    try {
      setError(null);
      const response: any = await api.get(`/api/monthly-time/status/${monthStartDate}`);
      const statusData = Array.isArray(response) ? response : (response.data || []);
      
      const statusMap: Record<number, TaskStatus> = {};
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na
          };
        });
      }
      
      setMonthlyTaskStatuses(statusMap);
    } catch (err: any) {
      console.error('Error loading monthly task statuses:', err);
      setError('Failed to load monthly task statuses');
      setMonthlyTaskStatuses({});
      throw err;
    }
  }, []);

  const updateMonthlyTaskStatus = useCallback(async (taskId: number, monthStartDate: string, status: Partial<TaskStatus>) => {
    try {
      await api.post(`/api/monthly-time/status/${taskId}/${monthStartDate}`, status);
      // Reload statuses after update
      await loadMonthlyTaskStatuses(monthStartDate);
    } catch (err: any) {
      console.error('Error updating monthly task status:', err);
      setError('Failed to update monthly task status');
      throw err;
    }
  }, [loadMonthlyTaskStatuses]);

  const loadDailyAggregatesForMonth = useCallback(async (monthStartDate: string) => {
    try {
      setError(null);
      const response: any = await api.get(`/api/daily-time/entries/month/${monthStartDate}`);
      
      const aggregatesMap: Record<string, number> = {};
      const dailyData = response.data || response;
      
      if (dailyData && typeof dailyData === 'object') {
        Object.entries(dailyData).forEach(([taskId, dayData]: [string, any]) => {
          if (dayData && typeof dayData === 'object') {
            Object.entries(dayData).forEach(([day, minutes]: [string, any]) => {
              const key = `${taskId}-${day}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      setDailyAggregatesMonthly(aggregatesMap);
    } catch (err: any) {
      console.error('Error loading daily aggregates for month:', err);
      setError('Failed to load daily aggregates');
      setDailyAggregatesMonthly({});
      throw err;
    }
  }, []);

  // ==================== YEARLY ENTRIES ====================

  const loadYearlyEntries = useCallback(async (year: number) => {
    try {
      setLoadingYearly(true);
      setError(null);
      const data = await api.get<YearlyEntry[]>(`/api/yearly-entries/?year=${year}`);
      setYearlyEntries(data);
    } catch (err: any) {
      console.error('Error loading yearly entries:', err);
      setError('Failed to load yearly entries');
      throw err;
    } finally {
      setLoadingYearly(false);
    }
  }, []);

  const saveYearlyEntry = useCallback(async (entry: Partial<YearlyEntry>): Promise<YearlyEntry> => {
    try {
      const newEntry = await api.post<YearlyEntry>('/api/yearly-entries/', entry);
      setYearlyEntries((prev) => [...prev, newEntry]);
      return newEntry;
    } catch (err: any) {
      console.error('Error saving yearly entry:', err);
      setError('Failed to save yearly entry');
      throw err;
    }
  }, []);

  const updateYearlyEntry = useCallback(async (entryId: number, updates: Partial<YearlyEntry>): Promise<YearlyEntry> => {
    try {
      const updatedEntry = await api.put<YearlyEntry>(`/api/yearly-entries/${entryId}`, updates);
      setYearlyEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      );
      return updatedEntry;
    } catch (err: any) {
      console.error('Error updating yearly entry:', err);
      setError('Failed to update yearly entry');
      throw err;
    }
  }, []);

  const loadYearlyTaskStatuses = useCallback(async (year: number) => {
    try {
      setError(null);
      const yearStartDate = `${year}-01-01`;
      const response: any = await api.get(`/api/yearly-time/status/${yearStartDate}`);
      const statusData = Array.isArray(response) ? response : (response.data || []);
      
      const statusMap: Record<number, TaskStatus> = {};
      if (Array.isArray(statusData)) {
        statusData.forEach((status: any) => {
          statusMap[status.task_id] = {
            is_completed: status.is_completed,
            is_na: status.is_na,
            created_at: status.created_at
          };
        });
      }
      
      setYearlyTaskStatuses(statusMap);
    } catch (err: any) {
      console.error('Error loading yearly task statuses:', err);
      setError('Failed to load yearly task statuses');
      setYearlyTaskStatuses({});
      throw err;
    }
  }, []);

  const updateYearlyTaskStatus = useCallback(async (taskId: number, year: number, status: Partial<TaskStatus>) => {
    try {
      const yearStartDate = `${year}-01-01`;
      await api.post(`/api/yearly-time/status/${taskId}/${yearStartDate}`, status);
      // Reload statuses after update
      await loadYearlyTaskStatuses(year);
    } catch (err: any) {
      console.error('Error updating yearly task status:', err);
      setError('Failed to update yearly task status');
      throw err;
    }
  }, [loadYearlyTaskStatuses]);

  const loadMonthlyAggregatesForYear = useCallback(async (year: number) => {
    try {
      setError(null);
      const yearStartDate = `${year}-01-01`;
      const response: any = await api.get(`/api/yearly-time/aggregates/${yearStartDate}`);
      const aggregatesData = response.data || response;
      
      // Convert aggregates to same format: "taskId-month"
      const aggregatesMap: Record<string, number> = {};
      if (aggregatesData && typeof aggregatesData === 'object') {
        Object.entries(aggregatesData).forEach(([taskId, monthData]: [string, any]) => {
          if (monthData && typeof monthData === 'object') {
            Object.entries(monthData).forEach(([month, minutes]: [string, any]) => {
              const key = `${taskId}-${month}`;
              aggregatesMap[key] = minutes;
            });
          }
        });
      }
      
      setYearlyMonthlyAggregates(aggregatesMap);
    } catch (err: any) {
      console.error('Error loading monthly aggregates for year:', err);
      setError('Failed to load monthly aggregates');
      setYearlyMonthlyAggregates({});
      throw err;
    }
  }, []);

  // ==================== ONE-TIME ENTRIES ====================

  const loadOneTimeEntries = useCallback(async () => {
    try {
      setLoadingOneTime(true);
      setError(null);
      const data = await api.get<OneTimeEntry[]>('/api/onetime-entries/');
      setOneTimeEntries(data);
    } catch (err: any) {
      console.error('Error loading one-time entries:', err);
      setError('Failed to load one-time entries');
      throw err;
    } finally {
      setLoadingOneTime(false);
    }
  }, []);

  const saveOneTimeEntry = useCallback(async (entry: Partial<OneTimeEntry>): Promise<OneTimeEntry> => {
    try {
      const newEntry = await api.post<OneTimeEntry>('/api/onetime-entries/', entry);
      setOneTimeEntries((prev) => [...prev, newEntry]);
      return newEntry;
    } catch (err: any) {
      console.error('Error saving one-time entry:', err);
      setError('Failed to save one-time entry');
      throw err;
    }
  }, []);

  const updateOneTimeEntry = useCallback(async (entryId: number, updates: Partial<OneTimeEntry>): Promise<OneTimeEntry> => {
    try {
      const updatedEntry = await api.put<OneTimeEntry>(`/api/onetime-entries/${entryId}`, updates);
      setOneTimeEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updatedEntry : entry))
      );
      return updatedEntry;
    } catch (err: any) {
      console.error('Error updating one-time entry:', err);
      setError('Failed to update one-time entry');
      throw err;
    }
  }, []);

  const value: TimeEntriesContextValue = {
    dailyEntries,
    loadingDaily,
    weeklyEntries,
    loadingWeekly,
    weeklyTaskStatuses,
    dailyAggregatesWeekly,
    monthlyEntries,
    loadingMonthly,
    monthlyTaskStatuses,
    dailyAggregatesMonthly,
    yearlyEntries,
    loadingYearly,
    yearlyTaskStatuses,
    yearlyMonthlyAggregates,
    oneTimeEntries,
    loadingOneTime,
    error,
    loadDailyEntries,
    saveDailyEntry,
    updateDailyEntry,
    deleteDailyEntry,
    loadWeeklyEntries,
    saveWeeklyEntry,
    updateWeeklyEntry,
    loadWeeklyTaskStatuses,
    updateWeeklyTaskStatus,
    loadDailyAggregatesForWeek,
    loadMonthlyEntries,
    saveMonthlyEntry,
    updateMonthlyEntry,
    loadMonthlyTaskStatuses,
    updateMonthlyTaskStatus,
    loadDailyAggregatesForMonth,
    loadYearlyEntries,
    saveYearlyEntry,
    updateYearlyEntry,
    loadYearlyTaskStatuses,
    updateYearlyTaskStatus,
    loadMonthlyAggregatesForYear,
    loadOneTimeEntries,
    saveOneTimeEntry,
    updateOneTimeEntry,
  };

  return (
    <TimeEntriesContext.Provider value={value}>
      {children}
    </TimeEntriesContext.Provider>
  );
};

/**
 * Hook to use Time Entries Context
 * Must be used within TimeEntriesProvider
 */
export const useTimeEntriesContext = (): TimeEntriesContextValue => {
  const context = useContext(TimeEntriesContext);
  if (context === undefined) {
    throw new Error('useTimeEntriesContext must be used within a TimeEntriesProvider');
  }
  return context;
};

export default TimeEntriesContext;
