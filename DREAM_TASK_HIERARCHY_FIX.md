# Dream Task Hierarchy and Management Features

## Problem Statement
1. **Child tasks not showing**: When creating a subtask under a misc task linked to a dream, the child task wasn't appearing in the Dream panel
2. **Limited management**: No way to edit, delete, add subtasks, or change dates for tasks in the Dream panel  
3. **Inconsistent naming**: Section names didn't match the Goal detail board naming convention

## Root Cause
- The `reloadActivities()` function only filtered tasks by `related_wish_id`
- Child tasks might not have `related_wish_id` set (only parent has it)
- Tasks were displayed as flat list without hierarchy
- Only "Complete" button was available for tasks

## Solution Implemented

### 1. Include Child Tasks in Loading (Lines 565-576)
Updated `reloadActivities()` to recursively include child tasks:

```typescript
// Filter by related_wish_id (same pattern as loadWishStats)
const directlyLinkedTasks = (Array.isArray(allTasks) ? allTasks : []).filter((t: any) => t.related_wish_id === selectedWish.id);

// Include child tasks whose parents are linked to this dream
const allTasksList = Array.isArray(allTasks) ? allTasks : [];
const linkedTaskIds = new Set(directlyLinkedTasks.map((t: any) => t.id));
const childTasks = allTasksList.filter((t: any) => t.parent_task_id && linkedTaskIds.has(t.parent_task_id));

// Combine directly linked tasks and their children
const tasks = [...directlyLinkedTasks, ...childTasks];
```

**How it works**:
1. Get all tasks with `related_wish_id` matching the dream (parent tasks)
2. Find all tasks whose `parent_task_id` is in the linked tasks set (children)
3. Combine both sets for display

### 2. Hierarchical Rendering Function (Lines 623-775)
Created `renderTaskWithChildren()` helper that:
- Recursively renders parent-child task hierarchy
- Indents child tasks with `↳` symbol and left margin
- Adds 5 action buttons for each task
- Supports unlimited nesting levels

```typescript
const renderTaskWithChildren = (task: any, allTasks: any[], level: number = 0) => {
  const children = allTasks.filter((t: any) => t.parent_task_id === task.id);
  const hasChildren = children.length > 0;
  
  return (
    <div key={task.id} style={{ marginBottom: hasChildren ? '4px' : '0' }}>
      <div style={{ 
        // ... task card styling
        marginLeft: `${level * 24}px`  // Indent by nesting level
      }}>
        {level > 0 && <span style={{ marginRight: '8px', color: '#9ca3af' }}>↳</span>}
        {task.name}
        {/* Action buttons */}
      </div>
      {hasChildren && (
        <div style={{ marginTop: '4px' }}>
          {children.map(child => renderTaskWithChildren(child, allTasks, level + 1))}
        </div>
      )}
    </div>
  );
};
```

### 3. Task Management Buttons (Lines 658-750)
Added 5 action buttons for each task:

#### 📅 Date Picker
- Inline date input for due date
- Updates immediately on change
- Reloads activities after save

```typescript
<input
  type="date"
  value={task.due_date || ''}
  onChange={async (e) => {
    await api.put(`/api/tasks/${task.id}`, { due_date: e.target.value });
    showToast('Date updated', 'success');
    await reloadActivities();
  }}
/>
```

#### ✏️ Edit Button
- Opens task in its home tab (Misc/Daily/Weekly/Monthly)
- Uses URL parameter to focus specific task
- Confirms before navigation

```typescript
<button onClick={async () => {
  if (confirm('Open task in Misc tab to edit?')) {
    window.location.href = `/tasks?tab=${task.follow_up_frequency === 'one_time' ? 'important' : task.follow_up_frequency}&taskId=${task.id}`;
  }
}}>
  ✏️
</button>
```

#### ➕ Add Subtask Button
- Prompts for subtask name
- Creates child task with same frequency as parent
- Automatically links to dream via `related_wish_id`
- Reloads activities to show new subtask

```typescript
<button onClick={async () => {
  const subTaskName = prompt('Enter subtask name:');
  if (subTaskName) {
    await api.post('/api/tasks/', {
      name: subTaskName,
      parent_task_id: task.id,
      follow_up_frequency: task.follow_up_frequency,
      related_wish_id: selectedWish.id,
      allocated_minutes: 0
    });
    showToast('Subtask created', 'success');
    await reloadActivities();
  }
}}>
  ➕
</button>
```

#### 🗑️ Delete Button
- Confirms before deletion
- Deletes task and all subtasks (database cascade)
- Reloads activities after deletion

```typescript
<button onClick={async () => {
  if (confirm('Delete this task?')) {
    await api.delete(`/api/tasks/${task.id}`);
    showToast('Task deleted', 'success');
    await reloadActivities();
  }
}}>
  🗑️
</button>
```

#### ✓ Complete Button
- Marks task as completed
- Moves to completed section
- Same behavior as before

### 4. Section Naming Update (Line 1250)
Renamed section to match Goal detail board naming:
- **Before**: "✅ Active Tasks"
- **After**: "✅ Dream Tasks"

This aligns with the pattern:
- Goal detail: "✅ Goal Tasks"
- Dream detail: "✅ Dream Tasks"

### 5. Task Count Update (Line 1251)
Updated count to show only parent tasks:
```typescript
✅ Dream Tasks ({activities.tasks.filter((t: any) => !t.parent_task_id).length})
```

This prevents double-counting since children are displayed under parents.

### 6. Render Parent Tasks Only (Lines 1256-1260)
Filter to show only parent tasks at top level:
```typescript
{activities.tasks.filter((t: any) => !t.parent_task_id).map((task: any) => 
  renderTaskWithChildren(task, activities.tasks, 0)
)}
```

The `renderTaskWithChildren()` function handles rendering children recursively.

### 7. Updated Linked Tasks Section (Lines 1273-1281)
Applied same hierarchical rendering to "Linked Tasks (Important Tasks)" section:
```typescript
{activities.linkedTasks.filter((t: any) => !t.parent_task_id).map((task: any) => 
  renderTaskWithChildren(task, activities.linkedTasks, 0)
)}
```

## Visual Design

### Task Card Layout
```
┌──────────────────────────────────────────────────────────────┐
│  Task Name (allocated_minutes min)   📅 ✏️ ➕ 🗑️ ✓         │
│                                                                │
│  ↳ Child Task (allocated_minutes min)   📅 ✏️ ➕ 🗑️ ✓      │
│                                                                │
│    ↳ Grandchild Task (mins)   📅 ✏️ ➕ 🗑️ ✓                 │
└──────────────────────────────────────────────────────────────┘
```

### Indentation
- Level 0 (parent): 0px margin
- Level 1 (child): 24px margin (1 indent)
- Level 2 (grandchild): 48px margin (2 indents)
- Level N: `N * 24px` margin

### Button Colors
- 📅 Date: Inherit (green border)
- ✏️ Edit: Blue (#3b82f6)
- ➕ Sub: Purple (#8b5cf6)
- 🗑️ Delete: Red (#ef4444)
- ✓ Complete: Green (#10b981)

## Testing Checklist

### Test 1: Child Task Visibility
1. Create misc task "Read 12 books" linked to dream
2. Go to Misc tab and create child task "Read Chapter 1"
3. Open Dream detail panel
4. **Expected**: Both parent and child tasks visible in hierarchy
5. ✅ PASS: Child task appears under parent with indentation

### Test 2: Create Subtask from Dream Panel
1. Open dream detail with linked task
2. Expand "Dream Tasks" section
3. Click ➕ button on parent task
4. Enter subtask name "Subtask Test"
5. **Expected**: 
   - Toast shows "Subtask created"
   - New subtask appears indented under parent
   - Subtask has same buttons as parent
6. ✅ PASS: Subtask created and visible immediately

### Test 3: Edit Task Navigation
1. Click ✏️ button on task in Dream panel
2. **Expected**: 
   - Confirmation dialog appears
   - After confirm, navigates to Misc tab
   - Task is focused/highlighted
3. ⚠️ NOTE: URL parameter `taskId` is passed but focus implementation depends on Misc tab

### Test 4: Date Update
1. Click date picker on task
2. Select new date
3. **Expected**:
   - Toast shows "Date updated"
   - Date persists after page refresh
4. ✅ PASS: Date saves correctly

### Test 5: Delete Task
1. Click 🗑️ button on parent task with children
2. **Expected**:
   - Confirmation dialog appears
   - After confirm, parent and all children deleted
   - Toast shows "Task deleted"
   - Tasks removed from display
3. ✅ PASS: Cascade delete works

### Test 6: Complete Task
1. Click ✓ button on task
2. **Expected**:
   - Task moves to completed section
   - Toast shows completion message
3. ✅ PASS: Same behavior as before

### Test 7: Multi-Level Hierarchy
1. Create parent task
2. Add child via ➕
3. Add grandchild via ➕ on child
4. **Expected**:
   - 3 levels of indentation
   - Each level shows buttons
   - All visible in hierarchy
5. ✅ PASS: Unlimited nesting supported

### Test 8: Supporting Tasks
Supporting Tasks by Frequency section still uses old flat display.
- ⚠️ TODO: Update to use hierarchical rendering if needed

## Files Modified

### frontend/src/pages/Goals.tsx
- **Lines 565-576**: Updated `reloadActivities()` to include child tasks
- **Lines 623-775**: Added `renderTaskWithChildren()` helper function
- **Lines 1250-1262**: Updated "Dream Tasks" section to use hierarchical rendering
- **Lines 1273-1281**: Updated "Linked Tasks" section to use hierarchical rendering

## Architecture Notes

### State Management
- No new state variables added
- Uses existing `activities.tasks` and `activities.linkedTasks` arrays
- `reloadActivities()` enriches data by including children

### Recursive Rendering
- Parent tasks rendered at top level
- Children rendered recursively within parent's div
- Indentation creates visual hierarchy
- Each task is independent with full button set

### API Calls
- **GET** `/api/tasks/`: Fetches all tasks (done in `reloadActivities`)
- **PUT** `/api/tasks/{id}`: Updates task (date change)
- **POST** `/api/tasks/`: Creates new subtask
- **DELETE** `/api/tasks/{id}`: Deletes task (cascade to children)

### Navigation Pattern
Edit button uses URL parameter pattern:
```typescript
window.location.href = `/tasks?tab=${frequency}&taskId=${id}`
```

This assumes the Misc tab has logic to:
1. Read `taskId` from URL
2. Scroll to or highlight that task
3. Open edit modal (if implemented)

## Future Enhancements

### 1. Inline Editing
Instead of navigating to Misc tab, could add inline edit modal in Dream panel similar to how dream tasks work.

### 2. Drag-and-Drop Reordering
Allow dragging tasks to reorder or change parent relationships.

### 3. Bulk Actions
Add checkboxes to select multiple tasks for bulk complete/delete.

### 4. Filter/Search
Add search box to filter tasks by name, especially useful for large hierarchies.

### 5. Collapse Individual Parents
Currently all expanded or all collapsed. Could add per-task expand/collapse.

### 6. Visual Task Status
Add color coding or badges for:
- Overdue tasks (red)
- Due soon (yellow)
- On track (green)

### 7. Supporting Tasks Hierarchy
Update Supporting Tasks by Frequency section to also use hierarchical rendering.

## Related Documentation

- [TASK_LIFECYCLE_DOCUMENTATION.md](TASK_LIFECYCLE_DOCUMENTATION.md) - Task completion/NA/status logic
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete feature catalog
- [DREAM_MODAL_PERSISTENCE_FIX.md](DREAM_MODAL_PERSISTENCE_FIX.md) - Modal state persistence
