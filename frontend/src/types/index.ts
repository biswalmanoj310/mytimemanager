/**
 * TypeScript Type Definitions for MyTimeManager API
 */

// Enums
export enum FollowUpFrequency {
  TODAY = 'today',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  ONE_TIME = 'one_time'
}

export enum GoalTimePeriod {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Pillar
export interface Pillar {
  id: number;
  name: string;
  description?: string;
  allocated_hours: number;
  color_code?: string;
  icon?: string;
  created_at: string;
  updated_at?: string;
}

// Category
export interface Category {
  id: number;
  name: string;
  description?: string;
  pillar_id: number;
  allocated_hours: number;
  color_code?: string;
  created_at: string;
  updated_at?: string;
  pillar?: Pillar;
}

// SubCategory
export interface SubCategory {
  id: number;
  name: string;
  description?: string;
  category_id: number;
  allocated_hours: number;
  created_at: string;
  updated_at?: string;
  category?: Category;
}

// Task
export interface Task {
  id: number;
  name: string;
  description?: string;
  pillar_id: number;
  category_id: number;
  sub_category_id?: number;
  allocated_minutes: number;
  spent_minutes: number;
  follow_up_frequency: FollowUpFrequency;
  separately_followed: boolean;
  goal_id?: number;
  is_part_of_goal: boolean;
  why_reason?: string;
  additional_whys?: string;
  is_active: boolean;
  is_completed: boolean;
  completed_at?: string;
  na_marked_at?: string;
  created_at: string;
  updated_at?: string;
  due_date?: string;
  pillar?: Pillar;
  category?: Category;
  sub_category?: SubCategory;
  pillar_name?: string;
  category_name?: string;
  sub_category_name?: string;
}

// Goal
export interface Goal {
  id: number;
  name: string;
  description?: string;
  pillar_id: number;
  category_id: number;
  sub_category_id?: number;
  goal_time_period: GoalTimePeriod;
  allocated_hours: number;
  spent_hours: number;
  why_reason?: string;
  is_active: boolean;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
  start_date?: string;
  end_date?: string;
  pillar?: Pillar;
  category?: Category;
  sub_category?: SubCategory;
}

// TimeEntry
export interface TimeEntry {
  id: number;
  task_id: number;
  entry_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  task?: Task;
}

// Dashboard Types
export interface DashboardStats {
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  completion_rate: number;
  total_allocated_hours: number;
  total_spent_hours: number;
  time_utilization: number;
}

export interface PillarStats {
  pillar_id: number;
  pillar_name: string;
  pillar_icon: string;
  pillar_color: string;
  total_goals: number;
  active_goals: number;
  completed_goals: number;
  total_tasks: number;
  completed_tasks: number;
  allocated_hours: number;
  spent_hours: number;
}

// Calendar Types
export interface CalendarDay {
  date: string;
  day_name: string;
  day: number;
  is_today: boolean;
  is_weekend: boolean;
  event_count: number;
  time_entry_count: number;
  task_count: number;
  tasks: Task[];
  time_entries: TimeEntry[];
  goals: Goal[];
}

export interface WeeklyCalendar {
  week_number: number;
  start_date: string;
  end_date: string;
  days: CalendarDay[];
  summary: {
    total_days: number;
    active_days: number;
    total_time_entries: number;
    total_hours: number;
  };
}

export interface MonthlyCalendar {
  year: number;
  month: number;
  month_name: string;
  days: CalendarDay[];
  goals: Goal[];
  summary: {
    total_days: number;
    active_days: number;
    total_events: number;
  };
}

// Analytics Types
export interface PillarDistribution {
  pillar_id: number;
  pillar_name: string;
  icon: string;
  color: string;
  allocated_hours: number;
  spent_hours: number;
  percentage: number;
  efficiency: number;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  pillar_name: string;
  allocated_hours: number;
  spent_hours: number;
  task_count: number;
  goal_count: number;
}

export interface TimeTrend {
  date: string;
  total_hours: number;
  hard_work_hours: number;
  calmness_hours: number;
  family_hours: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Form Types
export interface TaskFormData {
  name: string;
  description?: string;
  pillar_id: number;
  category_id: number;
  sub_category_id?: number;
  allocated_minutes: number;
  follow_up_frequency: FollowUpFrequency;
  due_date?: string;
  why_reason?: string;
}

export interface GoalFormData {
  name: string;
  description?: string;
  pillar_id: number;
  category_id: number;
  sub_category_id?: number;
  goal_time_period: GoalTimePeriod;
  allocated_hours: number;
  start_date?: string;
  end_date?: string;
  why_reason?: string;
}

export interface TimeEntryFormData {
  task_id: number;
  entry_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}
