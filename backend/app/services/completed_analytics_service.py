"""
Completed Tasks Analytics Service
Aggregates completion history (Task / ProjectTask / WishTask) into trend series,
mix breakdowns and momentum insights for the Completed page charts.
"""

from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.models.models import Task, ProjectTask, WishTask
from app.utils.timezone_utils import get_local_now
from app.utils.week_utils import get_week_start

UNCATEGORIZED = "Uncategorized"
NO_PILLAR = "Other"


class CompletedAnalyticsService:
    @staticmethod
    def _collect(db: Session) -> List[dict]:
        """Every completed item as a light dict: {date, type, pillar, category, on_time}."""
        items: List[dict] = []

        def add(obj, ttype: str, pillar: Optional[str], category: Optional[str]):
            ts = obj.completed_at or obj.updated_at
            if not ts:
                return
            due = obj.due_date.date() if obj.due_date else None
            items.append({
                "date": ts.date(),
                "type": ttype,
                "pillar": pillar or NO_PILLAR,
                "category": category or UNCATEGORIZED,
                "on_time": None if due is None else ts.date() <= due,
            })

        for t in db.query(Task).filter(Task.is_completed == True, Task.deleted_at == None).all():  # noqa: E712
            add(t, t.follow_up_frequency or "daily",
                t.pillar.name if t.pillar else None,
                t.category.name if t.category else None)

        for t in db.query(ProjectTask).filter(ProjectTask.is_completed == True).all():  # noqa: E712
            proj = t.project
            add(t, "project",
                proj.pillar.name if (proj and proj.pillar) else None,
                proj.category.name if (proj and proj.category) else None)

        for t in db.query(WishTask).filter(WishTask.is_completed == True).all():  # noqa: E712
            wish = t.wish
            add(t, "dream",
                wish.pillar_relation.name if (wish and wish.pillar_relation) else None,
                wish.category_relation.name if (wish and wish.category_relation) else None)

        return items

    @staticmethod
    def _bucket(items: List[dict], key_fn) -> Dict[date, dict]:
        buckets: Dict[date, dict] = defaultdict(
            lambda: {"total": 0, "by_type": Counter(), "by_pillar": Counter(), "by_category": Counter()}
        )
        for it in items:
            b = buckets[key_fn(it["date"])]
            b["total"] += 1
            b["by_type"][it["type"]] += 1
            b["by_pillar"][it["pillar"]] += 1
            b["by_category"][it["category"]] += 1
        return buckets

    @staticmethod
    def _point(label: str, start: date, bucket: Optional[dict]) -> dict:
        bucket = bucket or {"total": 0, "by_type": {}, "by_pillar": {}, "by_category": {}}
        return {
            "label": label,
            "start": start.isoformat(),
            "total": bucket["total"],
            "by_type": dict(bucket["by_type"]),
            "by_pillar": dict(bucket["by_pillar"]),
            "by_category": dict(bucket["by_category"]),
        }

    @staticmethod
    def _delta_pct(current: int, previous: int) -> Optional[float]:
        if previous == 0:
            return None
        return round((current - previous) / previous * 100, 1)

    @staticmethod
    def get_analytics(
        db: Session,
        task_types: Optional[Set[str]] = None,
        pillar_names: Optional[Set[str]] = None,
        category_names: Optional[Set[str]] = None,
        weeks: int = 12,
        months: int = 12,
        days: int = 84,
    ) -> dict:
        today = get_local_now().date()
        all_items = CompletedAnalyticsService._collect(db)

        # Filter options always come from the full history so the selector never shrinks while filtering
        options = {
            "types": dict(Counter(it["type"] for it in all_items)),
            "pillars": dict(Counter(it["pillar"] for it in all_items)),
            "categories": dict(Counter(it["category"] for it in all_items)),
        }

        items = [
            it for it in all_items
            if (not task_types or it["type"] in task_types)
            and (not pillar_names or it["pillar"] in pillar_names)
            and (not category_names or it["category"] in category_names)
        ]

        by_day = CompletedAnalyticsService._bucket(items, lambda d: d)
        by_week = CompletedAnalyticsService._bucket(items, get_week_start)
        by_month = CompletedAnalyticsService._bucket(items, lambda d: d.replace(day=1))

        # ── Series ──
        daily = []
        for i in range(days - 1, -1, -1):
            d = today - timedelta(days=i)
            daily.append(CompletedAnalyticsService._point(d.strftime("%b %d"), d, by_day.get(d)))

        this_week = get_week_start(today)
        weekly = []
        for i in range(weeks - 1, -1, -1):
            ws = this_week - timedelta(weeks=i)
            weekly.append(CompletedAnalyticsService._point(ws.strftime("%b %d"), ws, by_week.get(ws)))

        month_starts = []
        y, m = today.year, today.month
        for _ in range(months):
            month_starts.append(date(y, m, 1))
            m -= 1
            if m == 0:
                y, m = y - 1, 12
        monthly = [
            CompletedAnalyticsService._point(ms.strftime("%b %y"), ms, by_month.get(ms))
            for ms in reversed(month_starts)
        ]

        # ── Mix over the weekly window ──
        window_start = this_week - timedelta(weeks=weeks - 1)
        window = [it for it in items if it["date"] >= window_start]
        weekday = [0] * 7  # Sunday=0 … Saturday=6, matches the Sunday week start
        for it in window:
            weekday[(it["date"].weekday() + 1) % 7] += 1

        due_known = [it for it in window if it["on_time"] is not None]
        on_time = sum(1 for it in due_known if it["on_time"])

        # ── Insights ──
        last_week = this_week - timedelta(weeks=1)
        tw = by_week[this_week]["total"] if this_week in by_week else 0
        lw = by_week[last_week]["total"] if last_week in by_week else 0
        this_month = today.replace(day=1)
        last_month = (this_month - timedelta(days=1)).replace(day=1)
        tm = by_month[this_month]["total"] if this_month in by_month else 0
        lm = by_month[last_month]["total"] if last_month in by_month else 0

        weekly_totals = [w["total"] for w in weekly]
        # The current week is partial and would drag the average down, so exclude it
        full_weeks = weekly_totals[:-1] or weekly_totals

        return {
            "daily": daily,
            "weekly": weekly,
            "monthly": monthly,
            "options": options,
            "by_type": dict(Counter(it["type"] for it in window)),
            "by_pillar": dict(Counter(it["pillar"] for it in window)),
            "by_category": dict(Counter(it["category"] for it in window)),
            "weekday": weekday,
            "insights": {
                "total": len(items),
                "this_week": tw,
                "last_week": lw,
                "week_delta_pct": CompletedAnalyticsService._delta_pct(tw, lw),
                "this_month": tm,
                "last_month": lm,
                "month_delta_pct": CompletedAnalyticsService._delta_pct(tm, lm),
                "avg_per_week": round(sum(full_weeks) / len(full_weeks), 1) if full_weeks else 0,
                # Share of tasks with a due date that were finished on or before it
                "on_time_pct": round(on_time / len(due_known) * 100) if due_known else None,
                "on_time_total": len(due_known),
            },
        }
