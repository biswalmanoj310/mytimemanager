#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/mbiswal/projects/mytimemanager/backend')

from backend.app.database import SessionLocal
from backend.app.models.models import Task, WeeklyTaskStatus, MonthlyTaskStatus
from datetime import date, timedelta

db = SessionLocal()

# Get today and calculate week start (Monday)
today = date.today()
week_start = today - timedelta(days=today.weekday())

# Calculate month start
month_start = date(today.year, today.month, 1)

print(f'Today: {today}')
print(f'Week Start (Monday): {week_start}')
print(f'Month Start: {month_start}')
print()

# Find Speech and Debate task
speech_task = db.query(Task).filter(Task.name.like('%Speech%')).first()
if speech_task:
    print(f'Found task: {speech_task.name} (ID: {speech_task.id})')
    print(f'Follow-up frequency: {speech_task.follow_up_frequency}')
    print(f'Task type: {speech_task.task_type}')
    print(f'Target value: {speech_task.target_value}')
    print(f'Unit: {speech_task.unit}')
    print(f'Is active: {speech_task.is_active}')
    print()
    
    # Check weekly status
    weekly_status = db.query(WeeklyTaskStatus).filter(
        WeeklyTaskStatus.task_id == speech_task.id,
        WeeklyTaskStatus.week_start_date == week_start
    ).first()
    
    if weekly_status:
        print(f'✓ Weekly status found for current week!')
        print(f'  Week start: {weekly_status.week_start_date}')
        print(f'  Is completed: {weekly_status.is_completed}')
        print(f'  Is NA: {weekly_status.is_na}')
    else:
        print('✗ No weekly status found for current week')
        
        # Check all weekly statuses
        all_weekly = db.query(WeeklyTaskStatus).filter(
            WeeklyTaskStatus.task_id == speech_task.id
        ).all()
        
        if all_weekly:
            print(f'  But found {len(all_weekly)} weekly status(es) for other weeks:')
            for s in all_weekly:
                print(f'    - Week: {s.week_start_date}')
        else:
            print('  No weekly statuses found at all')
    
    print()
    
    # Check monthly status
    monthly_status = db.query(MonthlyTaskStatus).filter(
        MonthlyTaskStatus.task_id == speech_task.id,
        MonthlyTaskStatus.month_start_date == month_start
    ).first()
    
    if monthly_status:
        print(f'✓ Monthly status found for current month!')
        print(f'  Month start: {monthly_status.month_start_date}')
        print(f'  Is completed: {monthly_status.is_completed}')
        print(f'  Is NA: {monthly_status.is_na}')
    else:
        print('✗ No monthly status found for current month')
        
        # Check all monthly statuses
        all_monthly = db.query(MonthlyTaskStatus).filter(
            MonthlyTaskStatus.task_id == speech_task.id
        ).all()
        
        if all_monthly:
            print(f'  But found {len(all_monthly)} monthly status(es) for other months:')
            for s in all_monthly:
                print(f'    - Month: {s.month_start_date}')
        else:
            print('  No monthly statuses found at all')
else:
    print('✗ Speech and Debate task not found')
    print()
    print('All active daily tasks:')
    daily_tasks = db.query(Task).filter(
        Task.is_active == True, 
        Task.follow_up_frequency == 'daily'
    ).all()
    for t in daily_tasks[:15]:
        print(f'  - {t.name} (ID: {t.id}, type: {t.task_type})')

db.close()
