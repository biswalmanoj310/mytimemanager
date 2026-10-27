import apiClient from '../services/api';
import { formatDateForInput } from './dateHelpers';

export type DailyTabKind = 'time' | 'one_time';

/** task id -> YYYY-MM-DD of the day it was completed from the Daily tab */
export async function fetchDailyCompletionDates(): Promise<Map<number, string>> {
  try {
    const res = await apiClient.get('/api/daily-tasks-history/completion-dates');
    return new Map(Object.entries(res.data || {}).map(([id, date]) => [parseInt(id), date as string]));
  } catch {
    return new Map();
  }
}

/**
 * True when the Daily tab would list this task (same rules as the Analytics Detailed Trend picker):
 * active daily TIME task, not NA, not completed on a previous day.
 * Expects tasks fetched with is_active=true&is_completed=false.
 */
export function isDailyTabTask(task: any, kind: DailyTabKind, completionDates: Map<number, string>): boolean {
  if (task.follow_up_frequency !== 'daily') return false;
  if (task.task_type?.toUpperCase() !== 'TIME') return false;
  if (!task.is_active || task.na_marked_at) return false;
  if (kind === 'one_time' ? task.is_daily_one_time !== true : task.is_daily_one_time) return false;
  if (kind === 'time' && task.is_completed) return false;

  const completedOn = completionDates.get(task.id);
  return !(completedOn && completedOn < formatDateForInput(new Date()));
}
