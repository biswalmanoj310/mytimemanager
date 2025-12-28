"""
API routes for Upcoming Tasks
Displays future tasks across all categories (projects, goals, important, misc)
Excludes daily tasks, habits, and challenges
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import date, datetime, timedelta
from typing import List, Optional
from collections import defaultdict

from app.database.config import get_db
from app.models.models import Task, MiscTaskItem, MiscTaskGroup, Pillar, Category, ProjectTask, Project, DailyTaskStatus
from app.models.goal import LifeGoal, GoalProject, GoalProjectTaskLink


router = APIRouter(prefix="/api/upcoming-tasks", tags=["upcoming_tasks"])


@router.get("/")
def get_upcoming_tasks(
    month: Optional[int] = Query(None, description="Month number (1-12)"),
    year: Optional[int] = Query(None, description="Year (e.g., 2026)"),
    view: str = Query("month", description="View type: 'week', 'month', or 'all'"),
    db: Session = Depends(get_db)
):
    """
    Get all upcoming tasks grouped by pillar and type.
    Excludes daily tasks, habits, and challenges.
    Returns tasks from Important, Projects (Goals), and Misc categories.
    """
    
    today = date.today()
    
    # Determine date range based on view type
    if view == "week":
        # Next 7 days
        start_date = today + timedelta(days=1)  # Tomorrow
        end_date = today + timedelta(days=7)
    elif view == "all":
        # All future tasks
        start_date = today + timedelta(days=1)  # Tomorrow
        end_date = date(2099, 12, 31)  # Far future
    else:
        # Month view
        if month and year:
            # Specific month
            start_date = date(year, month, 1)
            
            # If selected month is current month, start from today instead of 1st
            if year == today.year and month == today.month:
                start_date = today + timedelta(days=1)  # Tomorrow
            
            # If start date is in the past, start from tomorrow
            if start_date < today:
                start_date = today + timedelta(days=1)
            
            # Last day of the month
            if month == 12:
                end_date = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
        else:
            # Next month by default
            next_month = today.replace(day=1) + timedelta(days=32)
            start_date = next_month.replace(day=1)
            # Last day of next month
            if start_date.month == 12:
                end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
    
    result = {
        "view": view,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "project_tasks": [],
        "goal_tasks": [],
        "important_tasks": [],
        "misc_tasks": [],
        "available_months": [],
        "all_tasks_count": 0  # Will be calculated at the end
    }
    
    # 1. Important Tasks (from Task model)
    # Exclude: daily tasks, habits, challenges, misc tasks, and tasks monitored as daily
    # Get all task IDs that are monitored as daily tasks
    daily_monitored_task_ids = db.query(DailyTaskStatus.task_id).distinct().all()
    daily_monitored_task_ids = [tid[0] for tid in daily_monitored_task_ids]
    
    important_tasks_query = db.query(Task).filter(
        Task.follow_up_frequency.notin_(['daily', 'habit', 'challenge', 'misc']),
        Task.due_date.isnot(None),
        Task.due_date >= start_date,
        Task.due_date <= end_date,
        Task.is_completed == False,
        Task.is_active == True,
        ~Task.name.like('Daily:%')  # Exclude tasks with "Daily:" prefix
    )
    
    # Exclude tasks that are monitored as daily
    if daily_monitored_task_ids:
        important_tasks_query = important_tasks_query.filter(~Task.id.in_(daily_monitored_task_ids))
    
    important_tasks = important_tasks_query.all()
    
    for task in important_tasks:
        result["important_tasks"].append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "category_name": task.category.name if task.category else None,
            "frequency": task.follow_up_frequency,
            "allocated_minutes": task.allocated_minutes,
            "task_type": task.task_type if task.task_type else None
        })
    
    # 2. Project Tasks (both standalone projects and goal projects)
    project_tasks = db.query(ProjectTask).join(
        Project, ProjectTask.project_id == Project.id
    ).filter(
        ProjectTask.due_date.isnot(None),
        ProjectTask.due_date >= start_date,
        ProjectTask.due_date <= end_date,
        ProjectTask.is_completed == False
    ).all()
    
    for task in project_tasks:
        project = task.project
        result["project_tasks"].append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority_new or 10,
            "project_name": project.name if project else None,
            "allocated_minutes": task.allocated_minutes
        })
    
    # 3. Goal-linked Tasks (via GoalProjectTaskLink)
    goal_task_links_query = db.query(GoalProjectTaskLink).join(
        GoalProject, GoalProjectTaskLink.goal_project_id == GoalProject.id
    ).join(
        LifeGoal, GoalProject.goal_id == LifeGoal.id
    ).join(
        Task, GoalProjectTaskLink.task_id == Task.id
    ).filter(
        Task.due_date.isnot(None),
        Task.due_date >= start_date,
        Task.due_date <= end_date,
        Task.is_completed == False,
        ~Task.name.like('Daily:%')  # Exclude tasks with "Daily:" prefix
    )
    
    # Exclude tasks that are monitored as daily
    if daily_monitored_task_ids:
        goal_task_links_query = goal_task_links_query.filter(~Task.id.in_(daily_monitored_task_ids))
    
    goal_task_links = goal_task_links_query.all()
    
    for link in goal_task_links:
        task = link.task
        goal_project = link.goal_project
        goal = goal_project.goal if goal_project else None
        
        result["goal_tasks"].append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "project_name": goal_project.name if goal_project else None,
            "goal_name": goal.name if goal else None,
            "category_name": goal.category.name if goal and goal.category else None
        })
    
    # 4. Misc Tasks (from misc_task_items table)
    misc_tasks = db.query(MiscTaskItem).join(
        MiscTaskGroup, MiscTaskItem.group_id == MiscTaskGroup.id
    ).filter(
        MiscTaskItem.due_date.isnot(None),
        MiscTaskItem.due_date >= start_date,
        MiscTaskItem.due_date <= end_date,
        MiscTaskItem.is_completed == False
    ).all()
    
    for task in misc_tasks:
        group = task.misc_task_group
        result["misc_tasks"].append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "group_name": group.name if group else None,
            "category_name": group.category.name if group and group.category else None
        })
    
    # Also query tasks with follow_up_frequency='misc' from tasks table
    misc_frequency_tasks = db.query(Task).filter(
        Task.due_date.isnot(None),
        Task.due_date >= start_date,
        Task.due_date <= end_date,
        Task.is_completed == False,
        Task.follow_up_frequency == 'misc'
    ).all()
    
    for task in misc_frequency_tasks:
        result["misc_tasks"].append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "priority": task.priority,
            "category_name": task.category.name if task.category else None
        })
    
    # Calculate available months (months that have tasks)
    # Query all tasks with future due dates
    all_future_important = db.query(Task.due_date).filter(
        Task.follow_up_frequency != 'daily',
        Task.due_date > today,
        Task.is_completed == False,
        Task.is_active == True,
        Task.due_date.isnot(None)
    ).all()
    
    all_future_project_tasks = db.query(ProjectTask.due_date).filter(
        ProjectTask.due_date > today,
        ProjectTask.is_completed == False,
        ProjectTask.due_date.isnot(None)
    ).all()
    
    all_future_goal_tasks = db.query(Task.due_date).join(
        GoalProjectTaskLink, Task.id == GoalProjectTaskLink.task_id
    ).filter(
        Task.due_date > today,
        Task.is_completed == False,
        Task.due_date.isnot(None)
    ).all()
    
    all_future_misc = db.query(MiscTaskItem.due_date).filter(
        MiscTaskItem.due_date > today,
        MiscTaskItem.is_completed == False,
        MiscTaskItem.due_date.isnot(None)
    ).all()
    
    # Collect unique year-month combinations
    months_set = set()
    for (due_date,) in all_future_important + all_future_project_tasks + all_future_goal_tasks + all_future_misc:
        if due_date:
            months_set.add((due_date.year, due_date.month))
    
    # Define count_tasks_in_range function first
    def count_tasks_in_range(start, end):
        count = 0
        # Important tasks (excluding daily, habits, challenges, misc frequency, and Daily: prefix)
        count += db.query(Task).filter(
            Task.follow_up_frequency.notin_(['daily', 'habit', 'challenge', 'misc']),
            Task.due_date >= start,
            Task.due_date <= end,
            Task.is_completed == False,
            Task.is_active == True,
            Task.due_date.isnot(None),
            ~Task.name.like('Daily:%')
        ).count()
        # Project tasks
        count += db.query(ProjectTask).filter(
            ProjectTask.due_date >= start,
            ProjectTask.due_date <= end,
            ProjectTask.is_completed == False,
            ProjectTask.due_date.isnot(None)
        ).count()
        # Goal tasks (excluding Daily: prefix)
        count += db.query(Task).join(
            GoalProjectTaskLink, Task.id == GoalProjectTaskLink.task_id
        ).filter(
            Task.due_date >= start,
            Task.due_date <= end,
            Task.is_completed == False,
            Task.due_date.isnot(None),
            ~Task.name.like('Daily:%')
        ).count()
        # Misc tasks from misc_task_items
        count += db.query(MiscTaskItem).filter(
            MiscTaskItem.due_date >= start,
            MiscTaskItem.due_date <= end,
            MiscTaskItem.is_completed == False,
            MiscTaskItem.due_date.isnot(None)
        ).count()
        # Misc tasks from tasks table with follow_up_frequency='misc'
        count += db.query(Task).filter(
            Task.follow_up_frequency == 'misc',
            Task.due_date >= start,
            Task.due_date <= end,
            Task.is_completed == False,
            Task.due_date.isnot(None)
        ).count()
        return count
    
    # Sort and format with task counts for each month
    sorted_months = sorted(list(months_set))
    result["available_months"] = []
    
    for y, m in sorted_months:
        # Calculate start and end of this month
        month_start = date(y, m, 1)
        if m == 12:
            month_end = date(y, 12, 31)
        else:
            month_end = date(y, m + 1, 1) - timedelta(days=1)
        
        # Count tasks for this month
        task_count = count_tasks_in_range(month_start, month_end)
        
        result["available_months"].append({
            "year": y,
            "month": m,
            "label": date(y, m, 1).strftime("%B %Y"),
            "count": task_count
        })
    
    # Calculate task counts for next week and next month (used in 'all' view)
    next_week_start = today + timedelta(days=1)
    next_week_end = today + timedelta(days=7)
    
    # Next month calculation
    if today.month == 12:
        next_month_start = date(today.year + 1, 1, 1)
        next_month_end = date(today.year + 1, 1, 31)
    else:
        next_month_start = date(today.year, today.month + 1, 1)
        # Calculate last day of next month
        if today.month + 1 == 12:
            next_month_end = date(today.year, 12, 31)
        else:
            next_month_end = date(today.year, today.month + 2, 1) - timedelta(days=1)
    
    result["next_week_count"] = count_tasks_in_range(next_week_start, next_week_end)
    result["next_month_count"] = count_tasks_in_range(next_month_start, next_month_end)
    
    # Calculate total count of all future tasks (for "All Tasks" button)
    all_tasks_start = today + timedelta(days=1)
    all_tasks_end = date(2099, 12, 31)
    result["all_tasks_count"] = count_tasks_in_range(all_tasks_start, all_tasks_end)
    
    return result
