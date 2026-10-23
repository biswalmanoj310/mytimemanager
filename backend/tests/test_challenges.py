"""
Tests for the challenge service: progress is always derived from the source of truth
(challenge entries, or the Daily tab for auto-synced challenges) inside the challenge window.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.config import Base
from app.models import goal as _goal_models  # noqa: F401 - registers LifeGoal for relationships
from app.models.models import DailyTimeEntry
from app.services import challenge_service as svc
from app.utils.timezone_utils import get_local_now


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def today():
    return get_local_now().date()


def make(db, **overrides):
    data = {
        "name": "Test challenge",
        "challenge_type": "daily_streak",
        "start_date": today() - timedelta(days=4),
        "end_date": today() + timedelta(days=5),
        "target_days": 10,
    }
    data.update(overrides)
    return svc.create_challenge(db, data)


def add_minutes(db, task_id, day, minutes, hour=9):
    db.add(DailyTimeEntry(
        task_id=task_id,
        entry_date=datetime.combine(day, datetime.min.time()),
        hour=hour,
        minutes=minutes,
    ))
    db.commit()


# ---------- streaks ----------

def test_current_streak_survives_an_unlogged_today():
    t = today()
    done = {t - timedelta(days=1), t - timedelta(days=2), t - timedelta(days=3)}
    assert svc.calculate_current_streak(done, t) == 3
    assert svc.calculate_current_streak(done | {t}, t) == 4


def test_current_streak_breaks_on_a_gap():
    t = today()
    assert svc.calculate_current_streak({t, t - timedelta(days=2)}, t) == 1
    assert svc.calculate_current_streak({t - timedelta(days=2)}, t) == 0


def test_longest_streak():
    t = today()
    done = {t - timedelta(days=d) for d in (0, 1, 5, 6, 7, 8, 12)}
    assert svc.calculate_longest_streak(done) == 4
    assert svc.calculate_longest_streak(set()) == 0


# ---------- manual logging ----------

def test_logging_updates_progress_and_values_can_be_reset(db):
    c = make(db, challenge_type="count_based", target_days=None, target_count=10, unit="treks")
    svc.log_challenge_entry(db, c.id, today(), is_completed=True, count_value=3)
    db.refresh(c)
    assert c.current_count == 3 and c.completed_days == 1 and c.current_streak == 1

    # correcting a day back to zero must stick (0 used to be treated as "not provided")
    svc.log_challenge_entry(db, c.id, today(), is_completed=False, count_value=0)
    db.refresh(c)
    assert c.current_count == 0 and c.completed_days == 0


def test_only_days_inside_the_window_count(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=100, unit="km")
    svc.log_challenge_entry(db, c.id, c.start_date - timedelta(days=3), True, numeric_value=50)
    svc.log_challenge_entry(db, c.id, today(), True, numeric_value=7.5)
    db.refresh(c)
    assert c.current_value == 7.5


def test_note_and_mood_are_kept_when_only_values_change(db):
    c = make(db)
    svc.log_challenge_entry(db, c.id, today(), True, note="felt good", mood="great")
    entry = svc.log_challenge_entry(db, c.id, today(), True, numeric_value=1)
    assert entry.note == "felt good" and entry.mood == "great"
    entry = svc.log_challenge_entry(db, c.id, today(), True, note="")
    assert entry.note is None


# ---------- status transitions ----------

def test_reaching_the_target_completes_the_challenge(db):
    c = make(db, challenge_type="count_based", target_days=None, target_count=3, unit="x")
    svc.log_challenge_entry(db, c.id, today(), True, count_value=3)
    db.refresh(c)
    assert c.status == "completed" and c.is_completed and c.completion_date


def test_expired_challenge_fails_and_can_be_reopened(db):
    c = make(db, start_date=today() - timedelta(days=10), end_date=today() - timedelta(days=5))
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.status == "failed"

    svc.reopen_challenge(db, c.id)
    db.refresh(c)
    assert c.status == "active" and c.end_date == today()


def test_manual_completion_is_not_overridden_by_recalculation(db):
    c = make(db, start_date=today() - timedelta(days=10), end_date=today() - timedelta(days=5))
    svc.complete_challenge(db, c.id)
    svc.refresh_active_challenges(db)
    svc.recalculate_challenge(db, c)
    assert c.status == "completed"


# ---------- updates ----------

def test_update_can_clear_nullable_fields_and_unlink_task(db):
    c = make(db, description="d", why_reason="w", linked_task_id=1, auto_sync=True, goal_id=4)
    assert c.auto_sync is True

    svc.update_challenge(db, c.id, {"description": None, "why_reason": None, "goal_id": None, "linked_task_id": None})
    db.refresh(c)
    assert c.description is None and c.why_reason is None and c.goal_id is None
    assert c.linked_task_id is None and c.auto_sync is False


def test_update_never_nulls_required_fields(db):
    c = make(db)
    svc.update_challenge(db, c.id, {"name": None, "start_date": None})
    db.refresh(c)
    assert c.name == "Test challenge" and c.start_date is not None


def test_goal_and_project_links_are_saved_on_create(db):
    c = make(db, goal_id=4, project_id=7)
    assert (c.goal_id, c.project_id) == (4, 7)


def test_extending_a_failed_challenge_reactivates_it(db):
    c = make(db, start_date=today() - timedelta(days=10), end_date=today() - timedelta(days=5))
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.status == "failed"
    svc.update_challenge(db, c.id, {"end_date": today() + timedelta(days=3)})
    db.refresh(c)
    assert c.status == "active"


# ---------- Daily tab sync ----------

def test_synced_challenge_mirrors_the_daily_tab(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=600, unit="min",
             linked_task_id=5, auto_sync=True)
    add_minutes(db, 5, today(), 30, hour=8)
    add_minutes(db, 5, today(), 45, hour=9)       # same day, two hours -> one day of 75 min
    add_minutes(db, 5, today() - timedelta(days=1), 20)
    add_minutes(db, 5, c.start_date - timedelta(days=2), 500)  # before the window
    add_minutes(db, 6, today(), 999)              # another task

    svc.sync_challenge_from_task(db, 5, today())
    db.refresh(c)
    assert c.current_value == 95
    assert c.completed_days == 2 and c.current_streak == 2


def test_removing_daily_time_removes_it_from_the_challenge(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=600, unit="min",
             linked_task_id=5, auto_sync=True)
    add_minutes(db, 5, today(), 60)
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.current_value == 60

    db.query(DailyTimeEntry).delete()
    db.commit()
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.current_value == 0 and c.completed_days == 0


def test_synced_streak_challenge_uses_the_daily_tab_only(db):
    c = make(db, linked_task_id=5, auto_sync=True)
    # a manual "done" mark must not count - the Daily tab is the source of truth
    svc.log_challenge_entry(db, c.id, today(), True, note="manual")
    add_minutes(db, 5, today() - timedelta(days=1), 15)
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.completed_days == 1

    entries = svc.get_challenge_entries(db, c.id)
    assert {e.entry_date for e in entries} == {today() - timedelta(days=1), today()}
    assert next(e for e in entries if e.entry_date == today()).note == "manual"


def test_creating_a_synced_challenge_pulls_existing_history(db):
    add_minutes(db, 5, today() - timedelta(days=2), 40)
    c = make(db, challenge_type="accumulation", target_days=None, target_value=100, unit="min",
             linked_task_id=5, auto_sync=True)
    assert c.current_value == 40


# ---------- metrics ----------

def test_metrics_for_a_counting_challenge(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=100, unit="km",
             start_date=today() - timedelta(days=9), end_date=today() + timedelta(days=20))
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=5), True, numeric_value=10)
    m = svc.build_challenge_metrics(db, c)
    assert m["days_total"] == 30 and m["days_elapsed"] == 10 and m["days_remaining"] == 20
    assert m["progress_percentage"] == 10.0
    assert m["status_indicator"] == "behind"
    # ideal share 3.33/day, 9 days before today -> should have 30, has 10 -> catch up 20 + today's share
    assert m["todays_target"] == pytest.approx(23.3, abs=0.1)
    assert m["completed_today"] is False


def test_unfinished_today_does_not_count_against_a_streak_challenge(db):
    c = make(db, start_date=today() - timedelta(days=3), end_date=today() + timedelta(days=3), target_days=7)
    for back in (1, 2, 3):
        svc.log_challenge_entry(db, c.id, today() - timedelta(days=back), True)
    m = svc.build_challenge_metrics(db, c)
    assert m["status_indicator"] == "on_track"
    assert m["completed_today"] is False


def test_future_challenge_is_not_started(db):
    c = make(db, start_date=today() + timedelta(days=3), end_date=today() + timedelta(days=9), target_days=7)
    m = svc.build_challenge_metrics(db, c)
    assert m["status_indicator"] == "not_started" and m["has_started"] is False


def test_stats_payload_matches_the_api_schema(db):
    from app.routes.challenges import ChallengeStatsResponse

    c = make(db)
    ChallengeStatsResponse(**svc.get_challenge_stats(db, c.id))


# ---------- actions ----------

def test_repeat_copies_links_and_resets_progress(db):
    c = make(db, linked_task_id=5, auto_sync=True, goal_id=4, project_id=7, category_id=2)
    add_minutes(db, 5, today(), 30)
    svc.refresh_active_challenges(db)
    repeated = svc.repeat_challenge(db, c.id)
    assert (repeated.linked_task_id, repeated.goal_id, repeated.project_id, repeated.category_id) == (5, 4, 7, 2)
    assert repeated.auto_sync is True
    assert repeated.start_date == today()
    assert repeated.end_date - repeated.start_date == c.end_date - c.start_date


def test_graduate_creates_a_habit_once(db):
    c = make(db, name="Cold showers", why_reason="energy")
    with pytest.raises(ValueError):
        svc.graduate_to_habit(db, c.id)  # not completed yet

    svc.complete_challenge(db, c.id)
    result = svc.graduate_to_habit(db, c.id)
    assert result["habit_name"] == "Cold showers"
    db.refresh(c)
    assert c.graduated_habit_id == result["habit_id"]
    with pytest.raises(ValueError):
        svc.graduate_to_habit(db, c.id)


# ---------- daily-minimum mode ("at least 20 pushups a day") ----------

def make_daily(db, minimum=20, days=20, required=None, **overrides):
    data = dict(
        challenge_type="count_based", target_days=None, unit="pushups",
        start_date=today() - timedelta(days=4), end_date=today() - timedelta(days=4) + timedelta(days=days - 1),
        daily_target=minimum, target_count=int(minimum * days), required_days=required,
    )
    data.update(overrides)
    return make(db, **data)


def test_only_days_reaching_the_minimum_count(db):
    c = make_daily(db)
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=2), True, count_value=20)
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=1), True, count_value=5)   # partial
    svc.log_challenge_entry(db, c.id, today(), True, count_value=25)                      # bonus
    db.refresh(c)
    assert c.completed_days == 2 and c.current_streak == 1 and c.longest_streak == 1
    assert c.current_count == 50  # the running total still includes the partial day


def test_missed_day_adds_no_catch_up_pressure(db):
    c = make_daily(db)
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=2), True, count_value=20)
    m = svc.build_challenge_metrics(db, c)
    assert m["todays_target"] == 20 and m["today_remaining"] == 20
    assert m["missed_days"] == 3          # days 1, 3 and yesterday... 4 days before today, 1 hit
    assert m["days_required"] == 20


def test_slack_decides_the_status(db):
    strict = make_daily(db, name="strict")
    assert svc.build_challenge_metrics(db, strict)["status_indicator"] == "behind"  # 4 missed, 0 allowed

    loose = make_daily(db, name="loose", required=17)  # 3 misses allowed, 4 days gone, none hit
    assert svc.build_challenge_metrics(db, loose)["status_indicator"] == "behind"

    svc.log_challenge_entry(db, loose.id, today() - timedelta(days=4), True, count_value=20)
    m = svc.build_challenge_metrics(db, loose)
    assert m["missed_days"] == 3 and m["status_indicator"] == "at_risk"   # no slack left

    svc.log_challenge_entry(db, loose.id, today() - timedelta(days=3), True, count_value=20)
    m = svc.build_challenge_metrics(db, loose)
    assert m["missed_days"] == 2 and m["status_indicator"] == "on_track"

    svc.log_challenge_entry(db, loose.id, today() - timedelta(days=2), True, count_value=5)  # partial day
    assert svc.build_challenge_metrics(db, loose)["missed_days"] == 2


def test_challenge_is_won_by_enough_hit_days_not_by_total(db):
    c = make_daily(db, minimum=10, days=6, required=3, start_date=today() - timedelta(days=2),
                   end_date=today() + timedelta(days=3))
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=2), True, count_value=100)  # one huge day
    db.refresh(c)
    assert c.status == "active"             # total is way above 60 but only one day counted
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=1), True, count_value=10)
    svc.log_challenge_entry(db, c.id, today(), True, count_value=10)
    db.refresh(c)
    assert c.status == "completed"


def test_create_via_api_derives_the_total_and_clears_slack_when_not_daily(db):
    from app.routes.challenges import ChallengeCreate, create_new_challenge

    body = ChallengeCreate(name="Pushups", challenge_type="count_based", start_date=today(),
                           end_date=today() + timedelta(days=19), unit="pushups", daily_target=20, required_days=18)
    c = create_new_challenge(body, db)
    assert (c.daily_target, c.required_days, c.target_count) == (20, 18, 400)

    streak = ChallengeCreate(name="Walk", challenge_type="daily_streak", start_date=today(),
                             end_date=today() + timedelta(days=6), daily_target=5)
    assert create_new_challenge(streak, db).daily_target is None


def test_editing_the_minimum_recomputes_the_total_and_progress(db):
    c = make_daily(db)
    svc.log_challenge_entry(db, c.id, today(), True, count_value=15)
    db.refresh(c)
    assert c.completed_days == 0
    svc.update_challenge(db, c.id, {"daily_target": 10})
    db.refresh(c)
    assert c.completed_days == 1 and c.target_count == 200
    svc.update_challenge(db, c.id, {"daily_target": None})
    db.refresh(c)
    assert c.daily_target is None and c.required_days is None


# ---------- hours ----------

def test_challenge_counted_in_hours_converts_daily_tab_minutes(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=100, unit="Hours",
             linked_task_id=5, auto_sync=True)
    add_minutes(db, 5, today(), 90)
    add_minutes(db, 5, today() - timedelta(days=1), 30)
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.current_value == pytest.approx(2.0)
    assert svc.build_challenge_metrics(db, c)["today_value"] == pytest.approx(1.5)


def test_daily_minimum_in_hours_uses_converted_values(db):
    c = make(db, challenge_type="accumulation", target_days=None, target_value=30, unit="hours",
             daily_target=1.5, linked_task_id=5, auto_sync=True,
             start_date=today() - timedelta(days=1), end_date=today() + timedelta(days=18))
    add_minutes(db, 5, today() - timedelta(days=1), 100)   # 1.67 h  -> hit
    add_minutes(db, 5, today(), 60)                        # 1.0 h   -> partial
    svc.refresh_active_challenges(db)
    db.refresh(c)
    assert c.completed_days == 1
    m = svc.build_challenge_metrics(db, c)
    assert m["completed_today"] is False and m["today_remaining"] == pytest.approx(0.5)


def test_graduating_a_daily_minimum_challenge_uses_the_minimum(db):
    c = make_daily(db, minimum=20, days=5)
    svc.complete_challenge(db, c.id)
    from app.models.models import Habit

    habit_id = svc.graduate_to_habit(db, c.id)["habit_id"]
    assert db.query(Habit).get(habit_id).target_value == 20


def test_repeat_keeps_the_daily_minimum(db):
    c = make_daily(db, required=18)
    r = svc.repeat_challenge(db, c.id)
    assert (r.daily_target, r.required_days) == (20, 18)


# ---------- honest status: "on track" must be earned ----------

def day_one(db, **overrides):
    data = dict(challenge_type="accumulation", target_days=None, unit="Minutes",
                start_date=today(), end_date=today() + timedelta(days=69))
    data.update(overrides)
    return make(db, **data)


def test_ten_minutes_toward_60000_in_70_days_is_not_on_track(db):
    c = day_one(db, target_value=60000)
    svc.log_challenge_entry(db, c.id, today(), True, numeric_value=10)
    m = svc.build_challenge_metrics(db, c)
    assert m["needed_per_day"] == pytest.approx(857, abs=1)     # ~14 h a day
    assert m["unrealistic_pace"] is True
    assert m["status_indicator"] == "behind"


def test_first_day_is_just_started_until_todays_part_is_done(db):
    c = day_one(db, target_value=6000)                          # ~86 min a day
    svc.log_challenge_entry(db, c.id, today(), True, numeric_value=10)
    m = svc.build_challenge_metrics(db, c)
    assert m["unrealistic_pace"] is False
    assert m["status_indicator"] == "just_started"
    assert m["projected_percentage"] is None                    # one partial day proves nothing

    svc.log_challenge_entry(db, c.id, today(), True, numeric_value=90)
    assert svc.build_challenge_metrics(db, c)["status_indicator"] == "on_track"


def test_long_challenge_is_flagged_early_not_after_ten_days(db):
    c = day_one(db, target_value=6000, start_date=today() - timedelta(days=5),
                end_date=today() + timedelta(days=64))
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=5), True, numeric_value=10)
    m = svc.build_challenge_metrics(db, c)
    assert m["days_behind"] > 3 and m["status_indicator"] == "behind"


def test_one_missed_day_is_still_on_track_and_two_is_at_risk(db):
    c = day_one(db, target_value=7000, start_date=today() - timedelta(days=3),
                end_date=today() + timedelta(days=66))          # 100/day
    for back in (3, 2):
        svc.log_challenge_entry(db, c.id, today() - timedelta(days=back), True, numeric_value=100)
    # one day (yesterday) missed
    assert svc.build_challenge_metrics(db, c)["status_indicator"] == "on_track"
    svc.log_challenge_entry(db, c.id, today() - timedelta(days=3), True, numeric_value=10)
    assert svc.build_challenge_metrics(db, c)["status_indicator"] == "at_risk"


def test_hours_target_that_needs_over_eight_hours_a_day_is_flagged(db):
    c = day_one(db, unit="Hours", target_value=1000)            # 14.3 h a day
    assert svc.build_challenge_metrics(db, c)["unrealistic_pace"] is True
    fine = day_one(db, name="fine", unit="Hours", target_value=100)
    assert svc.build_challenge_metrics(db, fine)["unrealistic_pace"] is False


def test_streak_challenge_is_just_started_until_logged_today(db):
    c = make(db, start_date=today(), end_date=today() + timedelta(days=6), target_days=7)
    assert svc.build_challenge_metrics(db, c)["status_indicator"] == "just_started"
    svc.log_challenge_entry(db, c.id, today(), True)
    assert svc.build_challenge_metrics(db, c)["status_indicator"] == "on_track"
