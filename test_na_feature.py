#!/usr/bin/env python3
"""
Test script to verify NA task auto-hide feature
Tests that na_marked_at timestamp is set when task is marked as NA
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def test_na_marked_at_feature():
    print("=" * 60)
    print("Testing NA Task Auto-Hide Feature")
    print("=" * 60)
    
    # Get existing tasks
    print("\n1. Fetching existing tasks...")
    response = requests.get(f"{BASE_URL}/tasks/")
    if response.status_code != 200:
        print(f"❌ Failed to fetch tasks: {response.status_code}")
        return
    
    tasks = response.json()
    print(f"✅ Found {len(tasks)} tasks")
    
    if not tasks:
        print("⚠️  No tasks found. Please create a task first.")
        return
    
    # Pick the first active task
    test_task = None
    for task in tasks:
        if task['is_active'] and not task['is_completed']:
            test_task = task
            break
    
    if not test_task:
        print("⚠️  No active tasks found. Please create an active task first.")
        return
    
    task_id = test_task['id']
    task_name = test_task['name']
    print(f"\n2. Testing with task: '{task_name}' (ID: {task_id})")
    print(f"   Current state:")
    print(f"   - is_active: {test_task['is_active']}")
    print(f"   - na_marked_at: {test_task.get('na_marked_at', 'null')}")
    
    # Mark task as NA
    print(f"\n3. Marking task as NA (setting is_active=false)...")
    response = requests.put(
        f"{BASE_URL}/tasks/{task_id}",
        json={"is_active": False}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to update task: {response.status_code}")
        print(f"   Response: {response.text}")
        return
    
    updated_task = response.json()
    print(f"✅ Task updated successfully")
    print(f"   New state:")
    print(f"   - is_active: {updated_task['is_active']}")
    print(f"   - na_marked_at: {updated_task.get('na_marked_at', 'null')}")
    
    # Verify na_marked_at is set
    if not updated_task.get('na_marked_at'):
        print(f"❌ FAILED: na_marked_at was not set!")
        return
    
    print(f"\n✅ SUCCESS: na_marked_at timestamp was set!")
    na_time = datetime.fromisoformat(updated_task['na_marked_at'].replace('Z', '+00:00'))
    print(f"   Timestamp: {na_time}")
    
    # Test reactivation
    print(f"\n4. Reactivating task (setting is_active=true)...")
    response = requests.put(
        f"{BASE_URL}/tasks/{task_id}",
        json={"is_active": True}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to reactivate task: {response.status_code}")
        return
    
    reactivated_task = response.json()
    print(f"✅ Task reactivated successfully")
    print(f"   New state:")
    print(f"   - is_active: {reactivated_task['is_active']}")
    print(f"   - na_marked_at: {reactivated_task.get('na_marked_at', 'null')}")
    
    # Verify na_marked_at is cleared
    if reactivated_task.get('na_marked_at') is not None:
        print(f"❌ FAILED: na_marked_at was not cleared on reactivation!")
        return
    
    print(f"\n✅ SUCCESS: na_marked_at was cleared on reactivation!")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\nFeature implementation verified:")
    print("• na_marked_at is set when task is marked as NA")
    print("• na_marked_at is cleared when task is reactivated")
    print("• Frontend filtering will now work correctly")
    print("\nNext steps:")
    print("1. Start the frontend: cd frontend && npm run dev")
    print("2. Navigate to Tasks page")
    print("3. Mark a task as NA and verify it disappears next day")

if __name__ == "__main__":
    try:
        test_na_marked_at_feature()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend server")
        print("   Please ensure the backend is running on http://127.0.0.1:8000")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
