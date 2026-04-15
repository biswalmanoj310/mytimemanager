/**
 * QuickAddTask Component
 * One-click task capture: shows a single-line popup to add a "today" task
 * with zero friction. Defaults to Family/Home Tasks + today's date + project "2026: Home Tasks".
 */

import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import './QuickAddTask.css';

interface QuickAddTaskProps {
  onSuccess: () => void;
}

export default function QuickAddTask({ onSuccess }: QuickAddTaskProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
    setIsOpen(false);
    setTaskName('');
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

      // --- Resolve project: "2026: Home Tasks" (optional — skip if not found) ---
      let projectId: number | undefined;
      try {
        const projects = await api.get<any[]>('/api/projects/');
        const homeProject = projects.find((p: any) => p.name === '2026: Home Tasks');
        if (homeProject) projectId = homeProject.id;
      } catch {
        // Project lookup is optional — proceed without it
      }

      // --- Today's date as datetime string (backend requires datetime, not date-only) ---
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDatetime = `${todayStr}T00:00:00`;

      // --- Create the task ---
      await api.post('/api/tasks/', {
        name,
        pillar_id: familyPillar.id,
        category_id: homeCat.id,
        follow_up_frequency: 'today',
        allocated_minutes: 30,
        due_date: todayDatetime,
        priority: 5,
        ...(projectId !== undefined ? { project_id: projectId } : {}),
      });

      setSuccessMsg(`"${name}" added to Today!`);
      setTaskName('');

      // Brief success flash, then close and refresh
      setTimeout(() => {
        setSuccessMsg(null);
        setIsOpen(false);
        onSuccess();
      }, 1200);
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
        title="Quick Add — capture a Today task instantly"
      >
        ⚡ Quick Add
      </button>

      {isOpen && (
        <div className="quick-add-popup">
          {successMsg ? (
            <div className="quick-add-success">✅ {successMsg}</div>
          ) : (
            <>
              <div className="quick-add-hint">
                📅 Today &nbsp;·&nbsp; 👨‍👩‍👦 Family / Home Tasks
                {' '}&nbsp;·&nbsp; <span className="quick-add-hint-tip">Press Enter to save, Esc to close</span>
              </div>
              <div className="quick-add-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  className="quick-add-input"
                  placeholder="What do you need to do today?"
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
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
              {error && <div className="quick-add-error">⚠ {error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
