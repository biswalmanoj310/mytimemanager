/**
 * QuickAddTask Component
 * One-click task capture: shows a single-line popup to add a task with zero friction.
 * Same behavior on every tab, driven by the due date (defaults to today, local time):
 *   - date = today  -> "today" task
 *   - any other date, or cleared -> "misc" task (30 min, optional due date)
 * Both are Family/Home Tasks and linked to the "2026: Home Tasks" project when it exists.
 * The popup stays open after saving (rapid multi-entry); closes on Esc, outside click, or 2 min idle.
 */

import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { formatDateForInput, parseDate, formatDateDisplay } from '../utils/dateHelpers';
import './QuickAddTask.css';

interface QuickAddTaskProps {
  onSuccess: () => void;
}

const IDLE_CLOSE_MS = 2 * 60 * 1000;
const SUCCESS_MSG_MS = 2500;

export default function QuickAddTask({ onSuccess }: QuickAddTaskProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  // null = untouched (follows today, even across midnight); '' = user cleared the date
  const [dueDateOverride, setDueDateOverride] = useState<string | null>(null);
  const todayStr = formatDateForInput(new Date());
  const dueDate = dueDateOverride ?? todayStr;
  const isMisc = dueDate !== todayStr;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const successTimerRef = useRef<number | null>(null);

  // Auto-focus input when popup opens, and again after each save (input is disabled while saving)
  useEffect(() => {
    if (isOpen && !loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, loading]);

  // Auto-close after 2 minutes without typing or saving
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => handleClose(), IDLE_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, taskName, successMsg]);

  useEffect(() => () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    setIsOpen(false);
    setTaskName('');
    setDueDateOverride(null);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async () => {
    const name = taskName.trim();
    if (!name) return;

    setLoading(true);
    setError(null);

    try {
      // --- Resolve pillar: Family ---
      const pillars = await api.get<any[]>('/api/pillars/');
      const familyPillar = pillars.find((p: any) => p.name === 'Family');
      if (!familyPillar) throw new Error('Family pillar not found in your data');

      // --- Resolve category: Home Tasks (under Family) ---
      const categories = await api.get<any[]>(`/api/categories?pillar_id=${familyPillar.id}`);
      const homeCat = categories.find((c: any) => c.name === 'Home Tasks');
      if (!homeCat) throw new Error('Home Tasks category not found under Family pillar');

      const taskPayload: any = {
        name,
        pillar_id: familyPillar.id,
        category_id: homeCat.id,
        allocated_minutes: 30,
        priority: 5,
      };

      taskPayload.follow_up_frequency = isMisc ? 'misc' : 'today';
      if (dueDate) taskPayload.due_date = `${dueDate}T00:00:00`;

      try {
        const projects = await api.get<any[]>('/api/projects/');
        const homeProject = projects.find((p: any) => p.name === '2026: Home Tasks');
        if (homeProject) taskPayload.project_id = homeProject.id;
      } catch {
        // Project lookup is optional — proceed without it
      }

      await api.post('/api/tasks/', taskPayload);

      setSuccessMsg(isMisc ? `"${name}" added as Misc Task!` : `"${name}" added to Today!`);
      setTaskName('');
      setDueDateOverride(null);

      // Keep the popup open for the next task; refresh the list in the background
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      successTimerRef.current = window.setTimeout(() => setSuccessMsg(null), SUCCESS_MSG_MS);
      onSuccess();
    } catch (err: any) {
      // Show backend validation detail if available (e.g. 422 field errors)
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError(err?.message || 'Failed to create task. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quick-add-container" ref={containerRef}>
      <button
        className={`btn-quick-add ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        title="Quick Add — today's date creates a Today task; another date creates a Misc task"
      >
        ⚡ Quick Add
      </button>

      {isOpen && (
        <div className="quick-add-popup">
          <div className="quick-add-hint">
            {!isMisc ? '📅 Today' : `📋 Misc Task · 30m${dueDate ? ` · due ${formatDateDisplay(parseDate(dueDate) ?? new Date())}` : ''}`} &nbsp;·&nbsp; 👨‍👩‍👦 Family / Home Tasks
            {' '}&nbsp;·&nbsp; <span className="quick-add-hint-tip">Enter to save &amp; add another, Esc to close</span>
          </div>
          <div className="quick-add-input-row">
            <input
              ref={inputRef}
              type="text"
              className="quick-add-input"
              placeholder={isMisc ? 'What misc task do you need to track?' : 'What do you need to do today?'}
              value={taskName}
              onChange={e => { setTaskName(e.target.value); setError(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleClose();
              }}
              disabled={loading}
              maxLength={200}
            />
            <button
              className="btn-quick-save"
              onClick={handleSubmit}
              disabled={loading || !taskName.trim()}
              title="Save task (Enter)"
            >
              {loading ? '…' : '→'}
            </button>
          </div>
          <div className="quick-add-date-row">
            <label htmlFor="quick-add-due-date">📆 Due date:</label>
            <input
              id="quick-add-due-date"
              type="date"
              className="quick-add-date-input"
              value={dueDate}
              onChange={e => setDueDateOverride(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <div className="quick-add-error">⚠ {error}</div>}
          {successMsg && !error && <div className="quick-add-success">✅ {successMsg}</div>}
        </div>
      )}
    </div>
  );
}

