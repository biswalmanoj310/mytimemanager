# Backend Updates Required for Enhanced Habit Modal

## Overview
The frontend AddHabitModal now supports linking habits to:
- ✅ SubCategories (for deeper organization)
- ✅ Life Goals (for long-term planning)
- ✅ Wishes (for aspirational connections)

The backend needs updates to fully support these features.

## Step 1: Run Database Migration

```bash
cd /Users/mbiswal/projects/mytimemanager
python3 apply_migration_habit_associations.py
```

This will add three new columns to the `habits` table:
- `sub_category_id` → Foreign key to `sub_categories.id`
- `life_goal_id` → Foreign key to `life_goals.id`
- `wish_id` → Foreign key to `wishes.id`

All columns are nullable with CASCADE SET NULL on delete.

## Step 2: Update Habit Model

**File**: `backend/app/models/models.py`

Find the `Habit` class (around line 600) and add these fields:

```python
class Habit(Base):
    __tablename__ = "habits"
    
    # ... existing fields ...
    
    # Organization within three-pillar framework
    pillar_id = Column(Integer, ForeignKey("pillars.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    
    # NEW: Add these three lines
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=True, index=True)
    life_goal_id = Column(Integer, ForeignKey("life_goals.id"), nullable=True, index=True)
    wish_id = Column(Integer, ForeignKey("wishes.id"), nullable=True, index=True)
    
    # ... existing fields ...
    
    # Relationships
    pillar = relationship("Pillar", foreign_keys=[pillar_id])
    category = relationship("Category", foreign_keys=[category_id])
    
    # NEW: Add these three relationships
    sub_category = relationship("SubCategory", foreign_keys=[sub_category_id])
    life_goal = relationship("LifeGoal", foreign_keys=[life_goal_id])
    wish = relationship("Wish", foreign_keys=[wish_id])
    
    linked_task = relationship("Task", foreign_keys=[linked_task_id])
    entries = relationship("HabitEntry", back_populates="habit", cascade="all, delete-orphan")
    streaks = relationship("HabitStreak", back_populates="habit", cascade="all, delete-orphan")
    sessions = relationship("HabitSession", foreign_keys="[HabitSession.habit_id]", cascade="all, delete-orphan")
    periods = relationship("HabitPeriod", foreign_keys="[HabitPeriod.habit_id]", cascade="all, delete-orphan")
```

## Step 3: Update Habit Routes

**File**: `backend/app/routes/habits.py`

### Update POST /api/habits/ endpoint

Add the new fields to the create habit logic (around line 50-100):

```python
@router.post("/")
def create_habit(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    habit_type: str = Form(...),
    pillar_id: Optional[int] = Form(None),
    category_id: Optional[int] = Form(None),
    
    # NEW: Add these three parameters
    sub_category_id: Optional[int] = Form(None),
    life_goal_id: Optional[int] = Form(None),
    wish_id: Optional[int] = Form(None),
    
    linked_task_id: Optional[int] = Form(None),
    # ... other parameters ...
    db: Session = Depends(get_db)
):
    """Create new habit"""
    habit_data = {
        "name": name,
        "description": description,
        "habit_type": habit_type,
        "pillar_id": pillar_id,
        "category_id": category_id,
        
        # NEW: Include these in habit creation
        "sub_category_id": sub_category_id,
        "life_goal_id": life_goal_id,
        "wish_id": wish_id,
        
        "linked_task_id": linked_task_id,
        # ... other fields ...
    }
    
    habit = habits_service.create_habit(db, habit_data)
    return habit
```

### Update GET /api/habits/ endpoint

Enhance the response to include related names (around line 200-250):

```python
@router.get("/")
def get_habits(db: Session = Depends(get_db)):
    """Get all habits"""
    habits = habits_service.get_all_habits(db)
    
    result = []
    for habit in habits:
        habit_dict = {
            "id": habit.id,
            "name": habit.name,
            "description": habit.description,
            # ... existing fields ...
            "pillar_id": habit.pillar_id,
            "pillar_name": habit.pillar.name if habit.pillar else None,
            "category_id": habit.category_id,
            "category_name": habit.category.name if habit.category else None,
            
            # NEW: Add these fields to response
            "sub_category_id": habit.sub_category_id,
            "sub_category_name": habit.sub_category.name if habit.sub_category else None,
            "life_goal_id": habit.life_goal_id,
            "life_goal_name": habit.life_goal.name if habit.life_goal else None,
            "wish_id": habit.wish_id,
            "wish_title": habit.wish.title if habit.wish else None,
            
            "linked_task_id": habit.linked_task_id,
            # ... other fields ...
        }
        result.append(habit_dict)
    
    return result
```

## Step 4: Update Habit Service

**File**: `backend/app/services/habits_service.py` (if it exists)

Make sure the service layer accepts and processes the new fields:

```python
def create_habit(db: Session, habit_data: dict):
    """Create new habit with associations"""
    habit = Habit(
        name=habit_data["name"],
        description=habit_data.get("description"),
        habit_type=habit_data["habit_type"],
        pillar_id=habit_data.get("pillar_id"),
        category_id=habit_data.get("category_id"),
        
        # NEW: Handle new associations
        sub_category_id=habit_data.get("sub_category_id"),
        life_goal_id=habit_data.get("life_goal_id"),
        wish_id=habit_data.get("wish_id"),
        
        linked_task_id=habit_data.get("linked_task_id"),
        # ... other fields ...
    )
    
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit
```

## Step 5: Test the Integration

### 5.1 Start Backend
```bash
cd /Users/mbiswal/projects/mytimemanager
./start_backend.sh
```

### 5.2 Test Endpoints

Test that sub-categories endpoint works:
```bash
curl http://localhost:8000/api/sub-categories
```

Test that life-goals endpoint works:
```bash
curl http://localhost:8000/api/life-goals
```

Test that wishes endpoint works:
```bash
curl http://localhost:8000/api/wishes
```

### 5.3 Test Habit Creation

Create a habit with all associations:
```bash
curl -X POST http://localhost:8000/api/habits/ \
  -F "name=Morning Meditation" \
  -F "habit_type=boolean" \
  -F "target_frequency=daily" \
  -F "is_positive=true" \
  -F "pillar_id=1" \
  -F "category_id=1" \
  -F "sub_category_id=1" \
  -F "life_goal_id=1" \
  -F "wish_id=1"
```

### 5.4 Test Habit Retrieval

Get all habits and verify new fields are returned:
```bash
curl http://localhost:8000/api/habits/
```

Look for:
- `sub_category_id` and `sub_category_name`
- `life_goal_id` and `life_goal_name`
- `wish_id` and `wish_title`

## Step 6: Frontend Testing

### 6.1 Start Frontend
```bash
cd /Users/mbiswal/projects/mytimemanager
./start_frontend.sh
```

### 6.2 Navigate to Habits Tab
1. Open http://localhost:3000
2. Click on "Tasks" or "Habits" tab
3. Click "Add Habit" button

### 6.3 Test Form Features

**Test Pillar → Category → SubCategory Flow:**
1. Select a Pillar
2. Verify Category dropdown appears with filtered options
3. Select a Category
4. Verify SubCategory dropdown appears with filtered options

**Test Monitor Existing Task:**
1. Click "Show" button in "Monitor Existing Task" section
2. Test frequency filter buttons: All / Daily / Weekly / Monthly
3. Verify task list updates based on filter
4. Select a task from dropdown

**Test Link to Life Goal:**
1. Click "Show" button in "Link to Life Goal" section
2. Verify life goals dropdown appears
3. Verify goals display as: "GoalName (category)"
4. Select a goal

**Test Link to Dream/Wish:**
1. Click "Show" button in "Link to Dream/Wish" section
2. Verify wishes dropdown appears
3. Verify wishes display their titles
4. Select a wish

**Test Form Submission:**
1. Fill in required fields (Name, Tracking Mode)
2. Optionally fill all association fields
3. Submit form
4. Verify habit is created successfully
5. Check database to confirm all IDs are saved

## Verification Queries

Check the database directly:

```sql
-- Check if columns exist
PRAGMA table_info(habits);

-- Check if any habits have associations
SELECT 
    id, 
    name, 
    sub_category_id, 
    life_goal_id, 
    wish_id 
FROM habits 
WHERE sub_category_id IS NOT NULL 
   OR life_goal_id IS NOT NULL 
   OR wish_id IS NOT NULL;

-- Check relationships work
SELECT 
    h.name as habit_name,
    sc.name as subcategory,
    lg.name as life_goal,
    w.title as wish
FROM habits h
LEFT JOIN sub_categories sc ON h.sub_category_id = sc.id
LEFT JOIN life_goals lg ON h.life_goal_id = lg.id
LEFT JOIN wishes w ON h.wish_id = w.id
WHERE h.id = 1;  -- Replace with actual habit ID
```

## Troubleshooting

### Issue: Migration fails
**Solution**: Check that sub_categories, life_goals, and wishes tables exist
```sql
SELECT name FROM sqlite_master WHERE type='table';
```

### Issue: Frontend can't load data
**Solution**: Verify API endpoints return data
```bash
curl http://localhost:8000/api/sub-categories
curl http://localhost:8000/api/life-goals
curl http://localhost:8000/api/wishes
```

### Issue: Form submits but associations not saved
**Solution**: 
1. Check browser console for errors
2. Check backend logs for errors
3. Verify backend routes accept the new Form parameters
4. Check habits_service includes new fields

### Issue: Task frequency filter not working
**Solution**: Verify tasks have `frequency` field populated
```sql
SELECT id, name, frequency FROM tasks LIMIT 10;
```

## Summary

After completing all steps:
- ✅ Database has three new foreign key columns
- ✅ Habit model includes new fields and relationships
- ✅ API routes accept and return new association data
- ✅ Frontend form creates habits with full associations
- ✅ Habits can be organized by pillar → category → subcategory
- ✅ Habits can link to tasks, life goals, and wishes
- ✅ All associations are optional and nullable

## Next Steps (Future Enhancements)

1. **Display Associations**: Show linked goal/wish on habit cards
2. **Analytics**: Track habit contribution to life goals
3. **Visual Tree**: Display goal-habit-task dependency graph
4. **Smart Suggestions**: Auto-suggest habits based on selected goals
5. **Progress Tracking**: Show how habits move wishes toward reality
6. **Conversion Workflow**: "Convert Wish to Goal" that suggests related habits

---

**Status**: Backend updates required before full feature is functional  
**Priority**: Medium (frontend works, backend needs enhancement)  
**Estimated Time**: 30-60 minutes
