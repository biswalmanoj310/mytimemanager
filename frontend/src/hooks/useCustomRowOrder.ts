import { useCallback, useMemo, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { applyRowOrder, clearRowOrders, hasRowOrder, moveRowId, readRowOrder, writeRowOrder, RowId } from '../utils/rowOrder';
import '../styles/RowReorder.css';

const INTERACTIVE = 'input,textarea,select,button,a,label,[contenteditable="true"]';

/**
 * Drag-to-reorder for table rows (or any element), persisted in localStorage.
 * `scope` identifies the saved order, e.g. "tasks:daily". Pass a `section` to keep
 * several independent lists (whose ids may overlap) under one scope, e.g. "tasks:today" + "misc".
 * Without a saved order `applyOrder` returns the list unchanged, so the default sort stays in charge.
 */
export function useCustomRowOrder(scope: string) {
  const [version, setVersion] = useState(0);
  const dragRef = useRef<{ id: RowId; key: string } | null>(null);
  const lastTarget = useRef<HTMLElement | null>(null);

  const keyOf = (section?: string) => (section ? `${scope}:${section}` : scope);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isCustom = useMemo(() => hasRowOrder(scope), [scope, version]);

  // `version` makes consumers' memos recompute after a drop or reset
  const applyOrderBy = useCallback(
    <T,>(items: T[], getId: (item: T) => RowId, section?: string): T[] =>
      applyRowOrder(items, readRowOrder(section ? `${scope}:${section}` : scope), getId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, version]
  );

  const applyOrder = useCallback(
    <T extends { id: RowId }>(items: T[], section?: string): T[] => applyOrderBy(items, i => i.id, section),
    [applyOrderBy]
  );

  const reset = useCallback(() => {
    clearRowOrders(scope);
    setVersion(v => v + 1);
  }, [scope]);

  const clearMarks = () => {
    lastTarget.current?.removeAttribute('data-row-drop');
    lastTarget.current = null;
  };

  /** Spread onto the row element. `visible` is the list rendered in the same table/section. */
  const rowProps = <T extends { id: RowId }>(id: RowId, visible: T[], section?: string) => {
    const key = keyOf(section);
    return {
      'data-row-reorderable': true,
      onMouseDown: (e: MouseEvent<HTMLElement>) => {
        const interactive = (e.target as HTMLElement).closest(INTERACTIVE);
        e.currentTarget.draggable = !interactive;
      },
      onDragStart: (e: DragEvent<HTMLElement>) => {
        dragRef.current = { id, key };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(id));
        e.currentTarget.setAttribute('data-row-dragging', 'true');
      },
      onDragOver: (e: DragEvent<HTMLElement>) => {
        const from = dragRef.current;
        if (!from || from.key !== key || from.id === id || !visible.some(v => v.id === from.id)) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        if (lastTarget.current && lastTarget.current !== e.currentTarget) clearMarks();
        lastTarget.current = e.currentTarget;
        e.currentTarget.setAttribute('data-row-drop', after ? 'below' : 'above');
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clearMarks();
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        const from = dragRef.current;
        const after = e.currentTarget.getAttribute('data-row-drop') === 'below';
        clearMarks();
        if (!from || from.key !== key || from.id === id) return;
        const ids = visible.map(v => v.id);
        if (!ids.includes(from.id)) return;
        e.preventDefault();
        writeRowOrder(key, moveRowId(ids, readRowOrder(key), from.id, id, after));
        setVersion(v => v + 1);
      },
      onDragEnd: (e: DragEvent<HTMLElement>) => {
        dragRef.current = null;
        clearMarks();
        e.currentTarget.removeAttribute('data-row-dragging');
        e.currentTarget.draggable = false;
      },
    };
  };

  return { applyOrder, applyOrderBy, rowProps, reset, isCustom };
}
