/**
 * Pure helpers for user-defined row order (drag & drop).
 * The saved order is a list of ids per scope; no saved order = default sort.
 */

const STORAGE_PREFIX = 'rowOrder:';

export type RowId = number | string;

export const readRowOrder = (scope: string): RowId[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + scope);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeRowOrder = (scope: string, ids: RowId[]): void => {
  try {
    if (ids.length === 0) localStorage.removeItem(STORAGE_PREFIX + scope);
    else localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(ids));
  } catch {
    // storage full or blocked - order just won't persist
  }
};

const scopeKeys = (scope: string): string[] => {
  const exact = STORAGE_PREFIX + scope;
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === exact || key.startsWith(exact + ':'))) keys.push(key);
    }
  } catch {
    // storage blocked
  }
  return keys;
};

/** True if the scope or any of its sections ("scope:section") has a saved order. */
export const hasRowOrder = (scope: string): boolean => scopeKeys(scope).length > 0;

/** Forget the saved order of the scope and all of its sections. */
export const clearRowOrders = (scope: string): void => {
  scopeKeys(scope).forEach(key => localStorage.removeItem(key));
};

/** Saved rows first (in saved order), everything else after in its default order. */
export const applyRowOrder = <T>(items: T[], saved: RowId[], getId: (item: T) => RowId): T[] => {
  if (saved.length === 0) return items;
  const position = new Map<RowId, number>(saved.map((id, i) => [id, i]));
  const pinned = items.filter(i => position.has(getId(i))).sort((a, b) => position.get(getId(a))! - position.get(getId(b))!);
  const rest = items.filter(i => !position.has(getId(i)));
  return [...pinned, ...rest];
};

/**
 * Move `fromId` next to `toId` within the visible list and return the new saved order.
 * Saved ids that are not visible (other tables, other days) keep their relative order after.
 */
export const moveRowId = (
  visibleIds: RowId[],
  saved: RowId[],
  fromId: RowId,
  toId: RowId,
  placeAfter: boolean
): RowId[] => {
  if (fromId === toId) return saved;
  const next = visibleIds.filter(id => id !== fromId);
  const targetIndex = next.indexOf(toId);
  if (targetIndex === -1) return saved;
  next.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, fromId);
  const visible = new Set(next);
  return [...next, ...saved.filter(id => !visible.has(id))];
};
