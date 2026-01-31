#!/usr/bin/env python3
"""
Fix Project Pillar and Category Inheritance

This script updates existing projects to inherit pillar_id and category_id
from their parent goals or wishes if they don't already have them.

Projects can be linked to:
1. Life Goals (goal_id) - inherit from life_goals table
2. Wishes/Dreams (related_wish_id) - inherit from wishes table

Usage:
    python fix_project_pillar_category.py
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Project, Wish
from app.models.goal import LifeGoal

# Database setup
DATABASE_URL = "sqlite:///./backend/database/mytimemanager.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def fix_project_inheritance():
    """Update projects to inherit pillar/category from parent goal or wish"""
    db = SessionLocal()
    
    try:
        # Get all projects
        projects = db.query(Project).all()
        
        updated_count = 0
        skipped_count = 0
        
        print(f"\n🔍 Found {len(projects)} total projects")
        print("=" * 60)
        
        for project in projects:
            # Skip if project already has both pillar and category
            if project.pillar_id and project.category_id:
                print(f"✓ Project '{project.name}' already has pillar/category")
                skipped_count += 1
                continue
            
            updated = False
            
            # Try to inherit from Life Goal
            if project.goal_id:
                goal = db.query(LifeGoal).filter(LifeGoal.id == project.goal_id).first()
                if goal:
                    if goal.pillar_id and not project.pillar_id:
                        project.pillar_id = goal.pillar_id
                        updated = True
                    if goal.category_id and not project.category_id:
                        project.category_id = goal.category_id
                        updated = True
                    
                    if updated:
                        print(f"📌 Updated '{project.name}' from goal '{goal.name}'")
                        print(f"   → Pillar ID: {project.pillar_id}, Category ID: {project.category_id}")
                        updated_count += 1
                        continue
            
            # Try to inherit from Wish/Dream
            if project.related_wish_id and not updated:
                wish = db.query(Wish).filter(Wish.id == project.related_wish_id).first()
                if wish:
                    if wish.pillar_id and not project.pillar_id:
                        project.pillar_id = wish.pillar_id
                        updated = True
                    if wish.category_id and not project.category_id:
                        project.category_id = wish.category_id
                        updated = True
                    
                    if updated:
                        print(f"💭 Updated '{project.name}' from wish '{wish.title}'")
                        print(f"   → Pillar ID: {project.pillar_id}, Category ID: {project.category_id}")
                        updated_count += 1
                        continue
            
            if not updated:
                print(f"⚠️  '{project.name}' has no parent goal/wish or parent has no pillar/category")
        
        # Commit all changes
        db.commit()
        
        print("=" * 60)
        print(f"\n✅ Migration complete!")
        print(f"   Updated: {updated_count} projects")
        print(f"   Skipped: {skipped_count} projects (already had pillar/category)")
        print(f"   Total: {len(projects)} projects")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()
    
    return True


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Fix Project Pillar/Category Inheritance")
    print("=" * 60)
    
    # Confirm before running
    response = input("\nThis will update projects to inherit pillar/category from parent goals/wishes.\nContinue? (y/n): ")
    
    if response.lower() != 'y':
        print("❌ Migration cancelled")
        sys.exit(0)
    
    success = fix_project_inheritance()
    
    if success:
        print("\n✅ Projects updated successfully!")
        print("\nNext steps:")
        print("1. Restart the backend if it's running")
        print("2. Check the Projects tab to see updated projects")
    else:
        print("\n❌ Migration failed - check errors above")
        sys.exit(1)
