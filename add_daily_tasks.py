#!/usr/bin/env python3
"""
Script to add daily tasks to the database
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

# Pillar mapping
PILLARS = {
    "Hard Work": 1,
    "Calmness": 2,
    "Family": 3
}

# Category mapping (existing and new ones we'll create)
CATEGORIES = {
    "Hard Work": {
        "Office Tasks": 1,
        "Learning": 2,
        "Confidence": None  # Will create
    },
    "Calmness": {
        "Yoga": 4  # Using existing "Sleep+Yoga"
    },
    "Family": {
        "My Tasks": None,      # Will create
        "Family Tasks": 5,     # Using existing "Home Tasks"
        "Time Waste": 6
    }
}

# Tasks data
TASKS_DATA = [
    ("cd-Mails-Tickets", 1, "Hard Work", "Office Tasks"),
    ("Code Coverage", 1.5, "Hard Work", "Office Tasks"),
    ("Code - Scripts", 0.5, "Hard Work", "Office Tasks"),
    ("Git Jenkin Tools", 0.25, "Hard Work", "Learning"),
    ("Cloud", 1, "Hard Work", "Learning"),
    ("LLM GenAI", 1.95, "Hard Work", "Learning"),
    ("Interview Related", 0.30, "Hard Work", "Learning"),
    ("Life Coach & NLP", 0.5, "Hard Work", "Confidence"),
    ("Toastmaster Task", 1, "Hard Work", "Confidence"),
    ("Yoga - Dhyan", 1, "Calmness", "Yoga"),
    ("Sleep", 7, "Calmness", "Yoga"),
    ("Planning", 0.25, "Family", "My Tasks"),
    ("Stocks", 0.2, "Family", "My Tasks"),
    ("Task (Bank/ mail)", 0.25, "Family", "My Tasks"),
    ("Commute", 1, "Family", "My Tasks"),
    ("Nature Needs", 1, "Family", "My Tasks"),
    ("Eating", 1, "Family", "My Tasks"),
    ("My Games", 0.5, "Family", "My Tasks"),
    ("Parent Talk", 0.25, "Family", "Family Tasks"),
    ("Home Task", 0.55, "Family", "Family Tasks"),
    ("Task Trishna", 0.5, "Family", "Family Tasks"),
    ("Task Divyanshi", 0.5, "Family", "Family Tasks"),
    ("Daughter Sports", 0.5, "Family", "Family Tasks"),
    ("Shopping", 0.25, "Family", "Family Tasks"),
    ("Family Friends", 0.25, "Family", "Family Tasks"),
    ("Youtube", 0.25, "Family", "Time Waste"),
    ("TV", 0.25, "Family", "Time Waste"),
    ("Facebook", 0.15, "Family", "Time Waste"),
    ("Nextdoor", 0.15, "Family", "Time Waste"),
    ("News", 0.1, "Family", "Time Waste"),
    ("Dark Future", 0.1, "Family", "Time Waste"),
]

def create_category_if_needed(pillar_name, category_name):
    """Create category if it doesn't exist"""
    pillar_id = PILLARS[pillar_name]
    
    if CATEGORIES[pillar_name].get(category_name) is not None:
        return CATEGORIES[pillar_name][category_name]
    
    print(f"Creating new category: {category_name} under {pillar_name}")
    
    response = requests.post(
        f"{BASE_URL}/categories/",
        json={
            "name": category_name,
            "pillar_id": pillar_id,
            "allocated_hours": 0
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to create category: {response.status_code}")
        print(f"   Response: {response.text}")
        return None
    
    category = response.json()
    category_id = category["id"]
    CATEGORIES[pillar_name][category_name] = category_id
    print(f"✅ Created category: {category_name} (ID: {category_id})")
    return category_id

def add_tasks():
    """Add all tasks to the database"""
    print("=" * 70)
    print("Adding Daily Tasks to Database")
    print("=" * 70)
    
    # First, create any missing categories
    print("\n1. Checking/Creating Categories...")
    for task_name, hours, pillar, category in TASKS_DATA:
        create_category_if_needed(pillar, category)
    
    print(f"\n2. Adding {len(TASKS_DATA)} tasks...")
    print("-" * 70)
    
    success_count = 0
    failed_count = 0
    
    for task_name, hours, pillar, category in TASKS_DATA:
        pillar_id = PILLARS[pillar]
        category_id = CATEGORIES[pillar][category]
        
        if category_id is None:
            print(f"❌ Skipping {task_name}: Category not available")
            failed_count += 1
            continue
        
        # Convert hours to minutes
        allocated_minutes = int(hours * 60)
        
        task_data = {
            "name": task_name,
            "pillar_id": pillar_id,
            "category_id": category_id,
            "allocated_minutes": allocated_minutes,
            "follow_up_frequency": "daily",  # All tasks are daily
            "separately_followed": False,
            "is_part_of_goal": False
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/tasks/",
                json=task_data
            )
            
            if response.status_code == 200:
                task = response.json()
                print(f"✅ Added: {task_name:30s} | {hours:5.2f}h | {pillar:12s} | {category}")
                success_count += 1
            else:
                print(f"❌ Failed: {task_name:30s} | Status: {response.status_code}")
                print(f"   Error: {response.text[:100]}")
                failed_count += 1
        except Exception as e:
            print(f"❌ Error adding {task_name}: {e}")
            failed_count += 1
    
    print("-" * 70)
    print(f"\n✅ Successfully added: {success_count} tasks")
    if failed_count > 0:
        print(f"❌ Failed: {failed_count} tasks")
    
    # Calculate total time
    total_hours = sum(hours for _, hours, _, _ in TASKS_DATA)
    print(f"\n📊 Total daily time allocated: {total_hours} hours")
    print("=" * 70)

if __name__ == "__main__":
    try:
        print("\nMaking sure backend is running...")
        response = requests.get(f"{BASE_URL}/pillars/")
        if response.status_code != 200:
            print("❌ Backend not responding properly")
            exit(1)
        
        add_tasks()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend server")
        print("   Please ensure the backend is running on http://127.0.0.1:8000")
        print("   Run: cd backend && python3 -m uvicorn app.main:app --reload --port 8000")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
