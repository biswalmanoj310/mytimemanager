/**
 * Task Context Provider
 * 
 * Provides global task state management for the entire application.
 * This includes tasks, pillars, categories, and related CRUD operations.
 * 
 * Used by: All tabs (Daily, Weekly, Monthly, Yearly, Projects, Habits, etc.)
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Task } from '../types';
import { api } from '../services/api';

// Task-related data interfaces
export interface Pillar {
  id: number;
  name: string;
  description?: string;
}

export interface Category {
  id: number;
  name: string;
  pillar_id: number;
  pillar_name?: string;
}

export interface LifeGoal {
  id: number;
  name: string;
  description?: string;
  pillar_id?: number;
  start_date?: string;
  target_date?: string;
  is_achieved: boolean;
}

interface TaskContextValue {
  // State
  tasks: Task[];
  pillars: Pillar[];
  categories: Category[];
  lifeGoals: LifeGoal[];
  loading: boolean;
  error: string | null;

  // CRUD Operations
  loadTasks: () => Promise<void>;
  loadPillars: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadLifeGoals: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: number, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (taskId: number) => Promise<void>;
  
  completeTask: (taskId: number) => Promise<void>;
  markTaskNA: (taskId: number) => Promise<void>;
  reactivateTask: (taskId: number) => Promise<void>;
}

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load all tasks from API
   */
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Task[]>('/api/tasks/');
      setTasks(data);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load all pillars from API
   */
  const loadPillars = useCallback(async () => {
    try {
      const data = await api.get<Pillar[]>('/api/pillars/');
      setPillars(data);
    } catch (err: any) {
      console.error('Error loading pillars:', err);
      setError('Failed to load pillars');
      throw err;
    }
  }, []);

  /**
   * Load all categories from API
   */
  const loadCategories = useCallback(async () => {
    try {
      const data = await api.get<Category[]>('/api/categories/');
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError('Failed to load categories');
      throw err;
    }
  }, []);

  /**
   * Load all life goals from API
   */
  const loadLifeGoals = useCallback(async () => {
    try {
      const data = await api.get<LifeGoal[]>('/api/life-goals/');
      setLifeGoals(data);
    } catch (err: any) {
      console.error('Error loading life goals:', err);
      setError('Failed to load life goals');
      throw err;
    }
  }, []);

  /**
   * Refresh all data (tasks, pillars, categories, goals)
   */
  const refreshAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        loadTasks(),
        loadPillars(),
        loadCategories(),
        loadLifeGoals(),
      ]);
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, [loadTasks, loadPillars, loadCategories, loadLifeGoals]);

  /**
   * Create a new task
   */
  const createTask = useCallback(async (taskData: Partial<Task>): Promise<Task> => {
    try {
      const newTask = await api.post<Task>('/api/tasks/', taskData);
      setTasks((prev) => [...prev, newTask]);
      return newTask;
    } catch (err: any) {
      console.error('Error creating task:', err);
      setError('Failed to create task');
      throw err;
    }
  }, []);

  /**
   * Update an existing task
   */
  const updateTask = useCallback(async (taskId: number, updates: Partial<Task>): Promise<Task> => {
    try {
      const updatedTask = await api.put<Task>(`/api/tasks/${taskId}`, updates);
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updatedTask : task))
      );
      return updatedTask;
    } catch (err: any) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
      throw err;
    }
  }, []);

  /**
   * Delete a task
   */
  const deleteTask = useCallback(async (taskId: number): Promise<void> => {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
      throw err;
    }
  }, []);

  /**
   * Mark task as completed
   */
  const completeTask = useCallback(async (taskId: number): Promise<void> => {
    try {
      await api.post(`/api/tasks/${taskId}/complete`, {});
      await loadTasks(); // Reload to get updated completion status
    } catch (err: any) {
      console.error('Error completing task:', err);
      setError('Failed to complete task');
      throw err;
    }
  }, [loadTasks]);

  /**
   * Mark task as Not Applicable (NA)
   */
  const markTaskNA = useCallback(async (taskId: number): Promise<void> => {
    try {
      await api.post(`/api/tasks/${taskId}/mark-na`, {});
      await loadTasks(); // Reload to get updated NA status
    } catch (err: any) {
      console.error('Error marking task NA:', err);
      setError('Failed to mark task NA');
      throw err;
    }
  }, [loadTasks]);

  /**
   * Reactivate a completed or NA task
   */
  const reactivateTask = useCallback(async (taskId: number): Promise<void> => {
    try {
      await api.post(`/api/tasks/${taskId}/reactivate`, {});
      await loadTasks(); // Reload to get updated status
    } catch (err: any) {
      console.error('Error reactivating task:', err);
      setError('Failed to reactivate task');
      throw err;
    }
  }, [loadTasks]);

  const value: TaskContextValue = {
    tasks,
    pillars,
    categories,
    lifeGoals,
    loading,
    error,
    loadTasks,
    loadPillars,
    loadCategories,
    loadLifeGoals,
    refreshAll,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    markTaskNA,
    reactivateTask,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

/**
 * Hook to use Task Context
 * Must be used within TaskProvider
 */
export const useTaskContext = (): TaskContextValue => {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

export default TaskContext;
