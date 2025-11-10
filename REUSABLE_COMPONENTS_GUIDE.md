# Reusable Organization Components Guide

## Overview

This guide explains how to use the new reusable organization components across the MyTimeManager application. These components implement best practices from productivity literature and provide consistent UX across all features.

## 📚 Research Foundation

### Why Add Pillar/Category to Goals and Challenges?

**YES! This is highly recommended based on:**

1. **Stephen Covey - "First Things First"**
   - Organize all activities around core values (your 3 pillars)
   - Life goals should align with your principles
   - Creates clarity on what matters most

2. **David Allen - "Getting Things Done" (GTD)**
   - Consistent categorization across all systems
   - Reduces cognitive load when reviewing/planning
   - Enables better context-based decision making

3. **James Clear - "Atomic Habits"**
   - Identity-based goals are more powerful
   - "I am a [pillar-aligned person]" > "I want to achieve X"
   - Example: "I am someone who values Hard Work (pillar) through Career Excellence (category)" makes career goals more compelling

4. **Cal Newport - "Deep Work"**
   - Focus on aligned work in specific domains
   - Challenges should target specific life areas
   - Prevents scattered effort across unrelated goals

5. **Simon Sinek - "Start With Why"**
   - Goals/Challenges anchored to pillars have stronger "why"
   - Motivation comes from alignment with core values
   - Reduces goal abandonment

## 🧩 Available Components

### 1. PillarCategorySelector

**Location:** `/frontend/src/components/PillarCategorySelector.tsx`

**Purpose:** Provides consistent pillar → category → subcategory selection with cascading filters.

**Features:**
- Automatic data loading from API
- Cascading dropdowns (category depends on pillar, subcategory depends on category)
- Error handling with retry
- Vertical or horizontal layout
- Optional subcategory
- Required/optional field support
- Customizable styling

**Usage Example:**

```tsx
import { PillarCategorySelector } from '../components/PillarCategorySelector';

function AddGoalForm() {
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<number | null>(null);

  return (
    <form onSubmit={handleSubmit}>
      <PillarCategorySelector
        selectedPillarId={selectedPillar}
        selectedCategoryId={selectedCategory}
        selectedSubCategoryId={selectedSubCategory}
        onPillarChange={setSelectedPillar}
        onCategoryChange={setSelectedCategory}
        onSubCategoryChange={setSelectedSubCategory}
        showSubCategory={true}
        required={true}  // Make pillar/category mandatory for goals
        layout="vertical"
      />
      
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="pillar_id" value={selectedPillar || ''} />
      <input type="hidden" name="category_id" value={selectedCategory || ''} />
      <input type="hidden" name="sub_category_id" value={selectedSubCategory || ''} />
      
      {/* Rest of form fields */}
    </form>
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedPillarId` | `number \| null` | - | Currently selected pillar ID |
| `selectedCategoryId` | `number \| null` | - | Currently selected category ID |
| `selectedSubCategoryId` | `number \| null` | - | Currently selected subcategory ID |
| `onPillarChange` | `(id: number \| null) => void` | - | Callback when pillar changes |
| `onCategoryChange` | `(id: number \| null) => void` | - | Callback when category changes |
| `onSubCategoryChange` | `(id: number \| null) => void` | - | Callback when subcategory changes |
| `showSubCategory` | `boolean` | `true` | Show subcategory dropdown |
| `required` | `boolean` | `false` | Make pillar/category required |
| `disabled` | `boolean` | `false` | Disable all dropdowns |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | Layout orientation |
| `labelStyle` | `React.CSSProperties` | `{}` | Custom label styling |
| `selectStyle` | `React.CSSProperties` | `{}` | Custom select styling |

---

### 2. TaskSelector

**Location:** `/frontend/src/components/TaskSelector.tsx`

**Purpose:** Provides task selection with frequency filtering and optional pillar/category filtering.

**Features:**
- Frequency filter buttons (All/Daily/Weekly/Monthly)
- Automatic filtering by pillar/category (when provided)
- Task details display (type, duration, target, frequency)
- Error handling with retry
- Customizable default frequency

**Usage Example:**

```tsx
import { TaskSelector } from '../components/TaskSelector';

function AddChallengeForm() {
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<number | null>(null);

  return (
    <form onSubmit={handleSubmit}>
      {/* First select pillar/category */}
      <PillarCategorySelector
        selectedPillarId={selectedPillar}
        onPillarChange={setSelectedPillar}
        // ...
      />
      
      {/* Then select task (automatically filtered by pillar) */}
      <TaskSelector
        selectedTaskId={selectedTask}
        onTaskChange={(taskId, task) => {
          setSelectedTask(taskId);
          console.log('Selected task:', task); // Full task object available
        }}
        defaultFrequency="daily"
        filterByPillar={selectedPillar}
        showFrequencyFilter={true}
        showTaskDetails={true}
        required={false}
      />
      
      <input type="hidden" name="linked_task_id" value={selectedTask || ''} />
    </form>
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedTaskId` | `number \| null` | - | Currently selected task ID |
| `onTaskChange` | `(id: number \| null, task?: Task) => void` | - | Callback with ID and full task object |
| `defaultFrequency` | `'all' \| 'daily' \| 'weekly' \| 'monthly'` | `'daily'` | Initial frequency filter |
| `filterByPillar` | `number \| null` | - | Auto-filter tasks by pillar |
| `filterByCategory` | `number \| null` | - | Auto-filter tasks by category |
| `showFrequencyFilter` | `boolean` | `true` | Show frequency buttons |
| `required` | `boolean` | `false` | Make task selection required |
| `disabled` | `boolean` | `false` | Disable task selection |
| `placeholder` | `string` | `'-- Select Task --'` | Dropdown placeholder |
| `showTaskDetails` | `boolean` | `false` | Show task info below dropdown |
| `labelStyle` | `React.CSSProperties` | `{}` | Custom label styling |
| `selectStyle` | `React.CSSProperties` | `{}` | Custom select styling |

---

## 🎯 Implementation Recommendations

### Add Goal Form

**Recommendation: YES - Make Pillar/Category REQUIRED**

```tsx
<PillarCategorySelector
  selectedPillarId={pillarId}
  selectedCategoryId={categoryId}
  onPillarChange={setPillarId}
  onCategoryChange={setCategoryId}
  required={true}  // ← Required for goals!
  showSubCategory={true}
  layout="vertical"
/>
```

**Why:**
- Goals without clear alignment lose motivation
- Easier to review goals by life area
- Supports "balanced life" reviews across pillars
- Enables goal conflict detection (too many in one pillar)

**Backend:** Add `pillar_id`, `category_id`, `sub_category_id` to `life_goals` table if not present.

---

### Challenge Form

**Recommendation: YES - Make Pillar/Category REQUIRED**

```tsx
<PillarCategorySelector
  selectedPillarId={pillarId}
  selectedCategoryId={categoryId}
  onPillarChange={setPillarId}
  onCategoryChange={setCategoryId}
  required={true}  // ← Required for challenges!
  showSubCategory={true}
  layout="vertical"
/>

{/* Optional: Link challenge to specific task */}
<TaskSelector
  selectedTaskId={taskId}
  onTaskChange={setTaskId}
  filterByPillar={pillarId}  // Auto-filter to same pillar
  filterByCategory={categoryId}
  showFrequencyFilter={true}
  required={false}
/>
```

**Why:**
- Challenges should target specific growth areas
- Prevents unfocused "30-day challenges"
- Enables challenge tracking by life domain
- Supports reflection: "Which pillar needs more challenges?"

**Backend:** Add `pillar_id`, `category_id`, `sub_category_id`, `linked_task_id` to challenges table.

---

### Dream/Wish Form

**Recommendation: OPTIONAL (Not Required)**

```tsx
<PillarCategorySelector
  selectedPillarId={pillarId}
  selectedCategoryId={categoryId}
  onPillarChange={setPillarId}
  onCategoryChange={setCategoryId}
  required={false}  // ← Optional for dreams
  showSubCategory={false}  // Dreams are high-level
  layout="horizontal"  // Compact layout
/>
```

**Why:**
- Dreams are often cross-pillar (e.g., "travel the world")
- Too rigid categorization limits imagination
- But pillar tagging helps prioritize concrete dreams
- Use for "dream portfolio balance" insights

---

## 🚀 Migration Path

### Phase 1: Habits (✅ DONE)
- AddHabitModal refactored
- Uses PillarCategorySelector
- Uses TaskSelector with frequency filtering

### Phase 2: Goals (RECOMMENDED NEXT)
1. Add columns to `life_goals` table:
   ```sql
   ALTER TABLE life_goals ADD COLUMN pillar_id INTEGER REFERENCES pillars(id);
   ALTER TABLE life_goals ADD COLUMN category_id INTEGER REFERENCES categories(id);
   ALTER TABLE life_goals ADD COLUMN sub_category_id INTEGER REFERENCES sub_categories(id);
   CREATE INDEX idx_life_goals_pillar ON life_goals(pillar_id);
   CREATE INDEX idx_life_goals_category ON life_goals(category_id);
   ```

2. Update backend models and schemas
3. Refactor Goal form to use `PillarCategorySelector`
4. Add pillar/category display to goals dashboard
5. Enable filtering goals by pillar/category

### Phase 3: Challenges
1. Add columns to challenges table (similar to goals)
2. Refactor Challenge form
3. Optional: Link challenges to tasks for progress tracking

### Phase 4: Dreams/Wishes
1. Add optional pillar tagging
2. Enable dream portfolio visualization by pillar

---

## 💡 UI/UX Best Practices

### Collapsible Sections
For optional associations (like task linking), use show/hide pattern:

```tsx
<div style={{ marginBottom: '16px' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <label>📋 Link to Task (Optional)</label>
    <button onClick={() => setShowTask(!showTask)}>
      {showTask ? 'Hide' : 'Show'}
    </button>
  </div>
  
  {showTask && <TaskSelector {...props} />}
</div>
```

### Visual Grouping
Wrap organizational elements in styled containers:

```tsx
<div style={{ 
  padding: '15px', 
  backgroundColor: '#f8f9fa', 
  borderRadius: '6px',
  border: '1px solid #e9ecef'
}}>
  <strong>🎯 Organize Your Goal</strong>
  <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
    Align with your life pillars (Hard Work, Calmness, Family)
  </small>
  
  <PillarCategorySelector {...props} />
</div>
```

### Help Text
Add contextual help for each feature:

```tsx
<small style={{ color: '#666', fontSize: '12px' }}>
  💡 Organizing by pillar helps maintain life balance and focus
</small>
```

---

## 🔍 Testing Checklist

After adding components to a new form:

- [ ] Pillar dropdown loads data
- [ ] Category dropdown filters by selected pillar
- [ ] SubCategory dropdown filters by selected category
- [ ] Task dropdown shows correct tasks
- [ ] Frequency filter buttons work
- [ ] Task filtering by pillar/category works
- [ ] Form submission includes all IDs
- [ ] Backend accepts and stores new fields
- [ ] Dashboard displays pillar/category info
- [ ] Filtering/searching by pillar works

---

## 📖 Example: Complete Goal Form Implementation

```tsx
import React, { useState } from 'react';
import { PillarCategorySelector } from '../components/PillarCategorySelector';
import { TaskSelector } from '../components/TaskSelector';
import { api } from '../services/api';

export const AddGoalModal = ({ show, onClose, onSuccess }) => {
  const [pillarId, setPillarId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [linkedTaskId, setLinkedTaskId] = useState<number | null>(null);
  const [showTaskLink, setShowTaskLink] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    
    const goalData = {
      name: formData.get('name'),
      description: formData.get('description'),
      pillar_id: pillarId,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      linked_task_id: linkedTaskId,
      start_date: formData.get('start_date'),
      target_date: formData.get('target_date'),
      // ... other fields
    };

    try {
      await api.post('/api/life-goals/', goalData);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  if (!show) return null;

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h2>Create Life Goal</h2>

        {/* Basic fields */}
        <input name="name" placeholder="Goal Name" required />
        <textarea name="description" placeholder="Description" />

        {/* Organization - REQUIRED for goals */}
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <strong>🎯 Goal Organization</strong>
          <small style={{ display: 'block', color: '#666', marginBottom: '10px' }}>
            Every goal should align with a life pillar
          </small>
          
          <PillarCategorySelector
            selectedPillarId={pillarId}
            selectedCategoryId={categoryId}
            selectedSubCategoryId={subCategoryId}
            onPillarChange={setPillarId}
            onCategoryChange={setCategoryId}
            onSubCategoryChange={setSubCategoryId}
            required={true}
            showSubCategory={true}
            layout="vertical"
          />
        </div>

        {/* Optional task linking */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label>📋 Link to Task (Optional)</label>
            <button type="button" onClick={() => setShowTaskLink(!showTaskLink)}>
              {showTaskLink ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showTaskLink && (
            <TaskSelector
              selectedTaskId={linkedTaskId}
              onTaskChange={(id) => setLinkedTaskId(id)}
              filterByPillar={pillarId}
              filterByCategory={categoryId}
              showFrequencyFilter={true}
              showTaskDetails={true}
              placeholder="-- No Task --"
            />
          )}
        </div>

        {/* Dates */}
        <input type="date" name="start_date" required />
        <input type="date" name="target_date" required />

        {/* Actions */}
        <button type="submit">Create Goal</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
};
```

---

## 🎓 Summary

These reusable components provide:
- ✅ Consistent UX across all features
- ✅ Research-backed organization (Covey, Allen, Clear, Newport, Sinek)
- ✅ Reduced code duplication
- ✅ Better maintainability
- ✅ Type-safe implementations
- ✅ Automatic data loading and error handling

**Next Steps:**
1. Review this guide
2. Add pillar/category to Goals form (highest priority)
3. Add pillar/category to Challenges form
4. Optional: Add to Dreams/Wishes
5. Update database schema for each feature
6. Add filtering/visualization by pillar across dashboard

