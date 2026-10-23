/**
 * Log (or correct) a single day of a challenge.
 * Synced challenges show the Daily tab total read-only - only note/mood are editable.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  Challenge,
  ChallengeEntry,
  LogPayload,
  MOODS,
  errorMessage,
  fmtAmount,
  fmtDate,
  isHoursUnit,
  isSynced,
  unitOf,
} from './challengeUtils';

interface ChallengeLogModalProps {
  challenge: Challenge;
  date: string;
  onClose: () => void;
  onSave: (payload: LogPayload) => Promise<void>;
}

export const ChallengeLogModal: React.FC<ChallengeLogModalProps> = ({ challenge, date, onClose, onSave }) => {
  const synced = isSynced(challenge);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState('');
  const [amount, setAmount] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [syncedValue, setSyncedValue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await api.get<ChallengeEntry[]>(
          `/api/challenges/${challenge.id}/entries?start_date=${date}&end_date=${date}`
        );
        const entry = Array.isArray(entries) ? entries[0] : undefined;
        if (cancelled) return;
        if (entry) {
          setDone(entry.is_completed);
          setCount(entry.count_value ? String(entry.count_value) : '');
          setAmount(entry.numeric_value ? String(entry.numeric_value) : '');
          setSyncedValue(entry.numeric_value || 0);
          setMood(entry.mood);
          setNote(entry.note || '');
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load this day'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challenge.id, date]);

  const unit = unitOf(challenge);

  const handleSave = async () => {
    const countValue = parseInt(count, 10) || 0;
    const amountValue = parseFloat(amount) || 0;
    const payload: LogPayload = { entry_date: date, is_completed: false, note, mood };

    if (synced) {
      payload.is_completed = syncedValue > 0;
    } else if (challenge.challenge_type === 'daily_streak') {
      payload.is_completed = done;
    } else if (challenge.challenge_type === 'count_based') {
      payload.is_completed = countValue > 0;
      payload.count_value = countValue;
    } else {
      payload.is_completed = amountValue > 0;
      payload.numeric_value = amountValue;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save'));
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="ch-modal-header">
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>{fmtDate(date)}</h2>
            <div className="ch-muted">{challenge.name}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p className="ch-muted">Loading…</p>
          ) : (
            <>
              {synced ? (
                <div className="ch-log-synced">
                  <strong>📡 {fmtAmount(challenge, syncedValue)} {isHoursUnit(challenge.unit) ? '' : unit || 'min'}</strong> logged in the Daily tab
                  <small>
                    This challenge mirrors <b>{challenge.linked_task_name}</b>. To change the time, edit it in the Daily tab —
                    you can still add a note or mood here.
                  </small>
                </div>
              ) : challenge.challenge_type === 'daily_streak' ? (
                <label className="ch-log-toggle">
                  <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
                  <span>{done ? '✅ I did it' : 'Did you do it this day?'}</span>
                </label>
              ) : challenge.challenge_type === 'count_based' ? (
                <div className="form-group">
                  <label>How many {unit}?{challenge.daily_target ? ` (minimum ${fmtAmount(challenge, challenge.daily_target)} to count)` : ''}</label>
                  <input
                    type="number" min="0" autoFocus value={count}
                    onChange={(e) => setCount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>How much {unit}?{challenge.daily_target ? ` (minimum ${fmtAmount(challenge, challenge.daily_target)} to count)` : ''}</label>
                  <input
                    type="number" min="0" step="any" autoFocus value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                </div>
              )}

              <div className="form-group">
                <label>How did it feel?</label>
                <div className="ch-moods">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className={`ch-mood ${mood === m.value ? 'is-selected' : ''}`}
                      onClick={() => setMood(mood === m.value ? null : m.value)}
                    >
                      <span>{m.emoji}</span>{m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Note (optional)</label>
                <textarea
                  rows={3} value={note} placeholder="What helped? What got in the way?"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error && <div className="ch-error">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={loading || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
