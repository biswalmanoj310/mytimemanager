#!/usr/bin/env python3
"""
Migration: Add sub_category_id, life_goal_id, and wish_id to Habit model
This enables linking habits to subcategories, life goals, and wishes
"""

import sys
import os
from sqlalchemy import create_engine, inspect, text

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database.config import DATABASE_URL

def run_migration():
    """Add new foreign key columns to habits table"""
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Check if table exists
    if 'habits' not in inspector.get_table_names():
        print("❌ habits table does not exist!")
        return False
    
    # Get existing columns
    existing_columns = [col['name'] for col in inspector.get_columns('habits')]
    
    with engine.connect() as conn:
        # Add sub_category_id if not exists
        if 'sub_category_id' not in existing_columns:
            print("✓ Adding sub_category_id column...")
            conn.execute(text("""
                ALTER TABLE habits 
                ADD COLUMN sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_habits_sub_category_id ON habits(sub_category_id)"))
            print("  ✓ sub_category_id added with index")
        else:
            print("  ℹ sub_category_id already exists")
        
        # Add life_goal_id if not exists
        if 'life_goal_id' not in existing_columns:
            print("✓ Adding life_goal_id column...")
            conn.execute(text("""
                ALTER TABLE habits 
                ADD COLUMN life_goal_id INTEGER REFERENCES life_goals(id) ON DELETE SET NULL
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_habits_life_goal_id ON habits(life_goal_id)"))
            print("  ✓ life_goal_id added with index")
        else:
            print("  ℹ life_goal_id already exists")
        
        # Add wish_id if not exists
        if 'wish_id' not in existing_columns:
            print("✓ Adding wish_id column...")
            conn.execute(text("""
                ALTER TABLE habits 
                ADD COLUMN wish_id INTEGER REFERENCES wishes(id) ON DELETE SET NULL
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_habits_wish_id ON habits(wish_id)"))
            print("  ✓ wish_id added with index")
        else:
            print("  ℹ wish_id already exists")
        
        conn.commit()
    
    print("\n✅ Migration complete!")
    print("\n📋 Summary:")
    print("   - sub_category_id: Link habits to specific subcategories")
    print("   - life_goal_id: Connect habits to long-term life goals")
    print("   - wish_id: Associate habits with dreams/aspirations")
    print("\n⚠️  Don't forget to update backend/app/models/models.py to include:")
    print("   - Column definitions for these fields")
    print("   - Relationships to SubCategory, LifeGoal, and Wish models")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("HABIT MODEL ENHANCEMENT MIGRATION")
    print("=" * 60)
    print("\nThis will add support for:")
    print("  • SubCategory linking")
    print("  • Life Goal association")
    print("  • Wish/Dream connection")
    print()
    
    try:
        success = run_migration()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
