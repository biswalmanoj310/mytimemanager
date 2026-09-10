/**
 * QuickAddSubtask Component
 * One-click subtask capture: shows a compact popup (name + optional due date)
 * with an "expand" toggle to reveal description + priority when needed.
 * Positions itself next to the triggering button (above/below/clamped to viewport).
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { api } from '../services/api';
import './QuickAddSubtask.css';

const POPUP_GAP = 8;

interface ParentTaskLike {
  id: number;
  name: string;
  pillar_id?: number | null;
  category_id?: number | null;
  is_completed?: boolean;
  goal_id?: number | null;
  related_wish_id?: number | null;
  linked_project_id?: number | null;
  project_id?: number | null;
}

interface QuickAddSubtaskProps {
  parentTask: ParentTaskLike | null;
  isOpen: boolean;
  anchorRect?: DOMRect | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function QuickAddSubtask({ parentTask, isOpen, anchorRect, onClose, onSuccess }: QuickAddSubtaskProps) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-focus name input when popup opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Measure the popup and place it beside the anchor button (flips above/below, clamps horizontally).
  // Falls back to a centered position near the top if no anchor was provided.
  useLayoutEffect(() => {
    if (!isOpen || !popupRef.current) {
      setPosition(null);
      return;
    }
    const rect = popupRef.current.getBoundingClientRect();
    if (!anchorRect) {
      setPosition({ top: Math.max(POPUP_GAP, window.innerHeight * 0.15), left: (window.innerWidth - rect.width) / 2 });
      return;
    }
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const showBelow = spaceBelow >= rect.height + POPUP_GAP || spaceBelow >= spaceAbove;
    const top = showBelow
      ? anchorRect.bottom + POPUP_GAP
      : Math.max(POPUP_GAP, anchorRect.top - rect.height - POPUP_GAP);
    let left = anchorRect.right - rect.width;
    left = Math.min(Math.max(left, POPUP_GAP), window.innerWidth - rect.width - POPUP_GAP);
    setPosition({ top, left });
  }, [isOpen, anchorRect, expanded]);

  // Close on Escape or click outside the popup
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !parentTask) return null;

  const resetState = () => {
    setName('');
    setDueDate('');
    setExpanded(false);
    setDescription('');
    setPriority('5');
    setError(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setLoading(true);
    setError(null);

    try {
      const taskPayload: any = {
        name: trimmedName,
        description: description || '',
        // Subtasks inherit pillar/category from the parent task
        pillar_id: parentTask.pillar_id || 1,
        category_id: parentTask.category_id || 1,
        task_type: 'time',
        allocated_minutes: 30,
        follow_up_frequency: 'misc',
        separately_followed: false,
        is_daily_one_time: false,
        priority: parseInt(priority, 10),
        parent_task_id: parentTask.id,
      };

      if (parentTask.goal_id) taskPayload.goal_id = parentTask.goal_id;
      if (parentTask.related_wish_id) taskPayload.related_wish_id = parentTask.related_wish_id;
      const inheritedProjectId = parentTask.linked_project_id || parentTask.project_id;
      if (inheritedProjectId) taskPayload.project_id = inheritedProjectId;

      if (dueDate) taskPayload.due_date = `${dueDate}T00:00:00`;

      await api.post('/api/tasks/', taskPayload);

      // If subtask was added to a completed parent, auto-mark parent as incomplete
      if (parentTask.is_completed) {
        await api.put(`/api/tasks/${parentTask.id}`, { is_completed: false });
      }

      setSuccessMsg(`"${trimmedName}" added!`);
      setTimeout(async () => {
        resetState();
        onClose();
        await onSuccess();
      }, 900);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => `${d.loc ? d.loc.join(' -> ') : 'field'}: ${d.msg}`).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError(err?.message || 'Failed to create subtask. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={popupRef}
      className="qas-popup"
      style={position ? { top: position.top, left: position.left, visibility: 'visible' } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {successMsg ? (
          <div className="qas-success">✅ {successMsg}</div>
        ) : (
          <>
            <div className="qas-header">
              ➕ Quick Subtask <span className="qas-parent-name" title={parentTask.name}>for "{parentTask.name}"</span>
            </div>

            <div className="qas-input-row">
              <input
                ref={inputRef}
                type="text"
                className="qas-input"
                placeholder="What's the subtask?"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmit();
                }}
                disabled={loading}
                maxLength={200}
              />
              <button
                className="qas-save-btn"
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
                title="Save subtask (Enter)"
              >
                {loading ? '…' : '→'}
              </button>
            </div>

            <div className="qas-date-row">
              <label htmlFor="qas-due-date">📆 Due date (optional):</label>
              <input
                id="qas-due-date"
                type="date"
                className="qas-date-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              type="button"
              className="qas-expand-toggle"
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? '▲ Fewer options' : '▼ More options (description, priority)'}
            </button>

            {expanded && (
              <div className="qas-expanded">
                <label htmlFor="qas-description">Description</label>
                <textarea
                  id="qas-description"
                  className="qas-textarea"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={loading}
                />

                <label htmlFor="qas-priority">Priority</label>
                <select
                  id="qas-priority"
                  className="qas-select"
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  disabled={loading}
                >
                  <option value="1">1 - Highest</option>
                  <option value="2">2 - High</option>
                  <option value="3">3 - Medium-High</option>
                  <option value="4">4 - Medium</option>
                  <option value="5">5 - Normal</option>
                  <option value="6">6 - Medium-Low</option>
                  <option value="7">7 - Low</option>
                  <option value="8">8 - Very Low</option>
                  <option value="9">9 - Minimal</option>
                  <option value="10">10 - Lowest</option>
                </select>
              </div>
            )}

            {error && <div className="qas-error">⚠ {error}</div>}

            <div className="qas-footer">
              <button type="button" className="qas-cancel-btn" onClick={handleClose} disabled={loading}>
                Cancel
              </button>
            </div>
          </>
        )}
    </div>
  );
}
