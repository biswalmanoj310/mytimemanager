"""
Completed Tasks Route
API endpoints for viewing completed tasks across all task types
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
from typing import Optional
from app.database.config import get_db
from app.models.models import Task, ProjectTask
from app.utils.timezone_utils import get_local_now

router = APIRouter(prefix="/api", tags=["completed"])


def _get_completed_at(task) -> Optional[datetime]:
    """Return the best available completion timestamp for a task."""
    return task.completed_at or task.updated_at


def _build_date_range(period: str, start_date_str: Optional[str], end_date_str: Optional[str]):
    """
    Return (start_date, end_date) datetime objects based on period.
    - today        → today midnight .. end of today
    - week         → this Monday midnight .. end of today
    - month        → 1st of this month midnight .. end of today
    - year         → 1st Jan of this year midnight .. end of today
    - last_7_days  → 7 days ago midnight .. end of today
    - last_30_days → 30 days ago midnight .. end of today
    - all          → None .. None (no filter)
    - custom       → from start_date_str .. end_date_str
    """
    today = get_local_now().date()
    end_of_today = datetime.combine(today, datetime.max.time())

    if period == "today":
        return datetime.combine(today, datetime.min.time()), end_of_today

    elif period == "week":
        # Monday of current week
        monday = today - timedelta(days=today.weekday())
        return datetime.combine(monday, datetime.min.time()), end_of_today

    elif period == "month":
        month_start = today.replace(day=1)
        return datetime.combine(month_start, datetime.min.time()), end_of_today

    elif period == "year":
        year_start = today.replace(month=1, day=1)
        return datetime.combine(year_start, datetime.min.time()), end_of_today

    elif period == "last_7_days":
        return datetime.combine(today - timedelta(days=7), datetime.min.time()), end_of_today

    elif period == "last_30_days":
        return datetime.combine(today - timedelta(days=30), datetime.min.time()), end_of_today

    elif period == "custom" and start_date_str:
        start = datetime.combine(datetime.strptime(start_date_str, "%Y-%m-%d").date(), datetime.min.time())
        end = end_of_today
        if end_date_str:
            end = datetime.combine(datetime.strptime(end_date_str, "%Y-%m-%d").date(), datetime.max.time())
        return start, end

    else:  # all
        return None, None


@router.get("/completed-tasks")
def get_completed_tasks(
    period: str = Query("today"),
    start_date_str: str = Query(None),
    end_date_str: str = Query(None),
    pillar_name: str = Query(None),
    category_name: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get all completed tasks (daily/misc/project tasks).
    Period options: today, week, month, year, last_7_days, last_30_days, all, custom
    Optional filters: pillar_name, category_name
    """
    start_date, end_date = _build_date_range(period, start_date_str, end_date_str)

    completed_tasks = []

    # ── Daily / Misc / One-time tasks (all from Task table) ──
    daily_query = db.query(Task).filter(Task.is_completed == True)
    if start_date:
        daily_query = daily_query.filter(
            or_(Task.completed_at >= start_date, Task.updated_at >= start_date)
        )
    if end_date:
        daily_query = daily_query.filter(
            or_(Task.completed_at <= end_date, Task.updated_at <= end_date)
        )
    if pillar_name:
        daily_query = daily_query.join(Task.pillar).filter(Task.pillar.has(name=pillar_name))
    if category_name:
        daily_query = daily_query.join(Task.category).filter(Task.category.has(name=category_name))

    for task in daily_query.all():
        completed_tasks.append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "completed_at": _get_completed_at(task),
            "task_type": task.follow_up_frequency or "daily",
            "source_table": "task",
            "category_name": task.category.name if task.category else None,
            "pillar_name": task.pillar.name if task.pillar else None,
            "project_name": task.project.name if task.project else None,
            "priority": task.priority,
            "due_date": task.due_date.date() if task.due_date else None,
        })

    # ── Project tasks ──
    project_query = db.query(ProjectTask).filter(ProjectTask.is_completed == True)
    if start_date:
        project_query = project_query.filter(
            or_(ProjectTask.completed_at >= start_date, ProjectTask.updated_at >= start_date)
        )
    if end_date:
        project_query = project_query.filter(
            or_(ProjectTask.completed_at <= end_date, ProjectTask.updated_at <= end_date)
        )

    for task in project_query.all():
        proj = task.project
        proj_pillar = proj.pillar.name if (proj and proj.pillar) else None
        proj_category = proj.category.name if (proj and proj.category) else None

        # Apply pillar/category filters for project tasks
        if pillar_name and proj_pillar != pillar_name:
            continue
        if category_name and proj_category != category_name:
            continue

        completed_tasks.append({
            "id": task.id,
            "name": task.name,
            "description": task.description,
            "completed_at": _get_completed_at(task),
            "task_type": "project",
            "source_table": "project_task",
            "category_name": proj_category,
            "pillar_name": proj_pillar,
            "project_name": proj.name if proj else None,
            "priority": task.priority,
            "due_date": task.due_date.date() if task.due_date else None,
        })

    # Sort by completion date (most recent first)
    completed_tasks.sort(key=lambda x: x["completed_at"] or datetime.min, reverse=True)

    # ── Stats: always calculated over the full unfiltered dataset ──
    all_daily = db.query(Task).filter(Task.is_completed == True).all()
    all_project = db.query(ProjectTask).filter(ProjectTask.is_completed == True).all()

    today = get_local_now().date()
    all_ts = [_get_completed_at(t).date() for t in all_daily + all_project if _get_completed_at(t)]

    monday = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    stats = {
        "today": sum(1 for d in all_ts if d == today),
        "week": sum(1 for d in all_ts if d >= monday),
        "month": sum(1 for d in all_ts if d >= month_start),
        "year": sum(1 for d in all_ts if d >= year_start),
        "last_7_days": sum(1 for d in all_ts if d >= today - timedelta(days=7)),
        "last_30_days": sum(1 for d in all_ts if d >= today - timedelta(days=30)),
        "all": len(all_ts),
    }

    # ── Available pillars & categories for filter dropdowns ──
    pillars = sorted({t["pillar_name"] for t in completed_tasks if t["pillar_name"]})
    categories = sorted({t["category_name"] for t in completed_tasks if t["category_name"]})

    return {
        "tasks": completed_tasks,
        "stats": stats,
        "pillars": pillars,
        "categories": categories,
    }


@router.post("/completed-tasks/{task_id}/restore")
def restore_task(
    task_id: int,
    source_table: str = Query(..., description="task or project_task"),
    db: Session = Depends(get_db)
):
    """Restore a completed task back to active (un-complete it)."""
    if source_table == "task":
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.is_completed = False
        task.completed_at = None
        db.commit()
        return {"message": "Task restored successfully"}

    elif source_table == "project_task":
        task = db.query(ProjectTask).filter(ProjectTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Project task not found")
        task.is_completed = False
        task.completed_at = None
        db.commit()
        return {"message": "Project task restored successfully"}

    else:
        raise HTTPException(status_code=400, detail="source_table must be 'task' or 'project_task'")
