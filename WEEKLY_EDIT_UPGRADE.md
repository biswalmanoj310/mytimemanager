# Weekly Tasks - Full Edit Form Implementation

## Problem
The EDIT button in the Weekly tasks tab was opening a simplified modal with only basic fields (name, description, allocated_minutes), which was "not much help" compared to the comprehensive edit form available in the Daily tab.

## Solution
Replaced the simplified inline edit modal with the reusable **TaskForm** component that provides full task editing capabilities.

## Changes Made

### File: `frontend/src/pages/WeeklyTasks.tsx`

1. **Added Import**
   ```typescript
   import TaskForm from '../components/TaskForm';
   ```

2. **Updated State Variables**
   - Removed: `editingTask`, `showEditModal`
   - Added: `isTaskFormOpen`, `editingTaskId`
   - Matches Daily tab pattern for consistency

3. **Simplified Edit Handler**
   ```typescript
   const handleEditTask = (task: Task) => {
     setEditingTaskId(task.id);
     setIsTaskFormOpen(true);
   };
   ```
   - Removed `handleSaveTask` (TaskForm handles all save logic internally)

4. **Replaced Edit Modal**
   - Removed ~150 lines of inline modal JSX
   - Added TaskForm component:
   ```typescript
   <TaskForm
     isOpen={isTaskFormOpen}
     taskId={editingTaskId || undefined}
     onClose={() => {
       setIsTaskFormOpen(false);
       setEditingTaskId(null);
     }}
     onSuccess={async () => {
       await loadTasks();
       setIsTaskFormOpen(false);
       setEditingTaskId(null);
     }}
   />
   ```

## What TaskForm Provides

The full TaskForm modal includes ALL editable task properties:

### Basic Information
- ✅ Task name
- ✅ Description
- ✅ Task type (Time/Count/Boolean)

### Organization
- ✅ Pillar selection (with icons)
- ✅ Category selection (filtered by pillar)
- ✅ Sub-category selection (filtered by category)

### Targets & Tracking
- ✅ Allocated minutes (for time tasks)
- ✅ Target value (for count tasks)
- ✅ Unit (for count tasks)
- ✅ Follow-up frequency (daily/weekly/monthly/quarterly/yearly/misc)

### Planning
- ✅ Priority (1-10 scale)
- ✅ Due date
- ✅ Parent task (for subtasks)
- ✅ Goal association
- ✅ Project association
- ✅ Wish association

### Motivation
- ✅ "Why" reason field
- ✅ Additional whys (multiple entries)

### Advanced Options
- ✅ Separately followed toggle
- ✅ Daily one-time toggle
- ✅ Part of goal toggle
- ✅ Ideal gap days (for important tasks)

## Benefits

1. **Feature Parity**: Weekly tab now has identical editing capabilities as Daily tab
2. **Code Reuse**: Single comprehensive form component used across all tabs
3. **Maintainability**: Changes to TaskForm automatically benefit all tabs
4. **User Experience**: Full control over task properties without tab switching
5. **Cleaner Code**: Removed 150+ lines of duplicate modal code

## Testing

To test the new edit functionality:

1. Navigate to Weekly tab
2. Click EDIT button on any weekly task
3. Verify full TaskForm modal opens with all fields populated
4. Edit any combination of fields:
   - Change task name
   - Update pillar/category
   - Modify allocated minutes
   - Set priority or due date
   - Add "why" reasons
5. Click Save
6. Verify changes persist after page reload

## Related Files

- `/frontend/src/components/TaskForm.tsx` - Reusable full task form (743 lines)
- `/frontend/src/pages/Tasks.tsx` - Daily tab (uses TaskForm)
- `/frontend/src/pages/WeeklyTasks.tsx` - Weekly tab (now uses TaskForm)

## Architecture Pattern

This follows the established pattern from the Daily tab:

```typescript
// State for editing
const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

// Handler to open form
const handleEdit = (task: Task) => {
  setEditingTaskId(task.id);
  setIsTaskFormOpen(true);
};

// Render form
<TaskForm
  isOpen={isTaskFormOpen}
  taskId={editingTaskId || undefined}  // undefined = create, number = edit
  onClose={() => { ... }}
  onSuccess={async () => { await loadTasks(); ... }}
/>
```

## Next Steps

Consider applying the same pattern to other tabs that might have simplified edit forms:
- Monthly tab
- Quarterly tab  
- Yearly tab
- Important Tasks tab

Each should use the centralized TaskForm component for consistency and feature parity.
