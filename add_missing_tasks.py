#!/usr/bin/env python3
"""
Script to add the remaining missing daily tasks
"""

import requests

BASE_URL = "http://127.0.0.1:8000/api"

# Missing tasks
MISSING_TASKS = [
    # Hard Work / Confidence
    ("Life Coach & NLP", 0.5, 1, 3),  # Hard Work, Confidence
    ("Toastmaster Task", 1, 1, 3),
    
    # Family / My Tasks - need to create this category first
    ("Planning", 0.25, 3, None),
    ("Stocks", 0.2, 3, None),
    ("Task (Bank/ mail)", 0.25, 3, None),
    ("Commute", 1, 3, None),
    ("Nature Needs", 1, 3, None),
    ("Eating", 1, 3, None),
    ("My Games", 0.5, 3, None),
]

def create_my_tasks_category():
    """Create My Tasks category under Family pillar"""
    print("Creating 'My Tasks' category...")
    response = requests.post(
        f"{BASE_URL}/categories/",
        json={
            "name": "My Tasks",
            "pillar_id": 3,  # Family
            "allocated_hours": 0
        }
    )
    
    if response.status_code in [200, 201]:
        category = response.json()
        print(f"✅ Created category: My Tasks (ID: {category['id']})")
        return category['id']
    else:
        print(f"❌ Failed to create category: {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def add_missing_tasks():
    """Add all missing tasks"""
    print("=" * 70)
    print("Adding Missing Daily Tasks")
    print("=" * 70)
    
    # Create My Tasks category
    my_tasks_category_id = create_my_tasks_category()
    
    if not my_tasks_category_id:
        # Try to get existing category
        response = requests.get(f"{BASE_URL}/categories/")
        if response.status_code == 200:
            categories = response.json()
            for cat in categories:
                if cat['name'] == 'My Tasks':
                    my_tasks_category_id = cat['id']
                    print(f"✅ Found existing 'My Tasks' category (ID: {my_tasks_category_id})")
                    break
    
    print("\nAdding tasks...")
    print("-" * 70)
    
    success_count = 0
    
    for task_name, hours, pillar_id, category_id in MISSING_TASKS:
        # If category_id is None, use My Tasks
        if category_id is None:
            category_id = my_tasks_category_id
        
        if category_id is None:
            print(f"❌ Skipping {task_name}: No category available")
            continue
        
        allocated_minutes = int(hours * 60)
        
        task_data = {
            "name": task_name,
            "pillar_id": pillar_id,
            "category_id": category_id,
            "allocated_minutes": allocated_minutes,
            "follow_up_frequency": "daily",
            "separately_followed": False,
            "is_part_of_goal": False
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/tasks/",
                json=task_data
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Added: {task_name:30s} | {hours:5.2f}h")
                success_count += 1
            else:
                print(f"❌ Failed: {task_name:30s} | Status: {response.status_code}")
                print(f"   Error: {response.text[:100]}")
        except Exception as e:
            print(f"❌ Error adding {task_name}: {e}")
    
    print("-" * 70)
    print(f"\n✅ Successfully added: {success_count} tasks")
    print("=" * 70)

if __name__ == "__main__":
    try:
        add_missing_tasks()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
