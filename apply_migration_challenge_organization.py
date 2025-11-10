"""
Database Migration: Add Pillar/Category/Task Support to Challenges
Adds pillar_id, category_id, sub_category_id, and linked_task_id to challenges table
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
        print("🔧 Adding pillar/category/task support to challenges table...")
        
        try:
            # Add pillar_id column
            conn.execute(text("""
                ALTER TABLE challenges 
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
                ALTER TABLE challenges 
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
                ALTER TABLE challenges 
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
                ALTER TABLE challenges 
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
                CREATE INDEX IF NOT EXISTS idx_challenges_pillar 
                ON challenges(pillar_id)
            """))
            conn.commit()
            print("✅ Created index on pillar_id")
        except Exception as e:
            print(f"⚠️  Index on pillar_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_challenges_category 
                ON challenges(category_id)
            """))
            conn.commit()
            print("✅ Created index on category_id")
        except Exception as e:
            print(f"⚠️  Index on category_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_challenges_sub_category 
                ON challenges(sub_category_id)
            """))
            conn.commit()
            print("✅ Created index on sub_category_id")
        except Exception as e:
            print(f"⚠️  Index on sub_category_id: {e}")
        
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_challenges_linked_task 
                ON challenges(linked_task_id)
            """))
            conn.commit()
            print("✅ Created index on linked_task_id")
        except Exception as e:
            print(f"⚠️  Index on linked_task_id: {e}")
        
        print("\n✨ Migration completed successfully!")
        print("Challenges now support pillar/category organization and task linking")

if __name__ == "__main__":
    migrate()
