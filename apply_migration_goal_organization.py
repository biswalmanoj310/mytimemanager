"""
Database Migration: Add Pillar/Category/Task Support to Life Goals
Adds pillar_id, category_id, sub_category_id, and linked_task_id to life_goals table
"""

import sys
import os

# Add parent directory to path to import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database.config import DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("🔧 Adding pillar/category/task support to life_goals table...")
        
        try:
            # Add pillar_id column
            conn.execute(text("""
                ALTER TABLE life_goals 
                ADD COLUMN pillar_id INTEGER REFERENCES pillars(id)
            """))
            conn.commit()
            print("✅ Added pillar_id column")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  pillar_id column already exists")
            else:
                print(f"❌ Error adding pillar_id: {e}")
                raise
        
        try:
            # Add category_id column
            conn.execute(text("""
                ALTER TABLE life_goals 
                ADD COLUMN category_id INTEGER REFERENCES categories(id)
            """))
            conn.commit()
            print("✅ Added category_id column")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  category_id column already exists")
            else:
                print(f"❌ Error adding category_id: {e}")
                raise
        
        try:
            # Add sub_category_id column
            conn.execute(text("""
                ALTER TABLE life_goals 
                ADD COLUMN sub_category_id INTEGER REFERENCES sub_categories(id)
            """))
            conn.commit()
            print("✅ Added sub_category_id column")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  sub_category_id column already exists")
            else:
                print(f"❌ Error adding sub_category_id: {e}")
                raise
        
        try:
            # Add linked_task_id column
            conn.execute(text("""
                ALTER TABLE life_goals 
                ADD COLUMN linked_task_id INTEGER REFERENCES tasks(id)
            """))
            conn.commit()
            print("✅ Added linked_task_id column")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  linked_task_id column already exists")
            else:
                print(f"❌ Error adding linked_task_id: {e}")
                raise
        
        # Create indexes for performance
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_life_goals_pillar 
                ON life_goals(pillar_id)
            """))
            conn.commit()
            print("✅ Created index on pillar_id")
        except Exception as e:
            print(f"⚠️  Index on pillar_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_life_goals_category 
                ON life_goals(category_id)
            """))
            conn.commit()
            print("✅ Created index on category_id")
        except Exception as e:
            print(f"⚠️  Index on category_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_life_goals_sub_category 
                ON life_goals(sub_category_id)
            """))
            conn.commit()
            print("✅ Created index on sub_category_id")
        except Exception as e:
            print(f"⚠️  Index on sub_category_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_life_goals_linked_task 
                ON life_goals(linked_task_id)
            """))
            conn.commit()
            print("✅ Created index on linked_task_id")
        except Exception as e:
            print(f"⚠️  Index on linked_task_id: {e}")
        
        print("\n✨ Migration completed successfully!")
        print("Life goals now support pillar/category organization and task linking")

if __name__ == "__main__":
    migrate()
