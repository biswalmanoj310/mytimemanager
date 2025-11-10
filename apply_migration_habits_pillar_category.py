"""
Database migration to add pillar_id and category_id to habits table
This allows habits to be organized within the three-pillar framework

Run with: python apply_migration_habits_pillar_category.py
"""

import sqlite3
from pathlib import Path

def migrate():
    """Add pillar_id and category_id columns to habits table"""
    db_path = Path(__file__).parent / "backend" / "database" / "mytimemanager.db"
    
    print("🔧 Starting migration: Add pillar_id and category_id to habits...")
    print(f"📁 Database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(habits)")
        columns = [col[1] for col in cursor.fetchall()]
        
        needs_pillar = 'pillar_id' not in columns
        needs_category = 'category_id' not in columns
        
        if not needs_pillar and not needs_category:
            print("✅ Columns already exist. Migration not needed.")
            return
        
        # Add pillar_id column
        if needs_pillar:
            print("  📝 Adding pillar_id column...")
            cursor.execute("""
                ALTER TABLE habits
                ADD COLUMN pillar_id INTEGER
                REFERENCES pillars(id)
            """)
            print("  ✅ pillar_id column added")
        
        # Add category_id column  
        if needs_category:
            print("  📝 Adding category_id column...")
            cursor.execute("""
                ALTER TABLE habits
                ADD COLUMN category_id INTEGER
                REFERENCES categories(id)
            """)
            print("  ✅ category_id column added")
        
        # Create indexes for better query performance
        if needs_pillar:
            print("  📝 Creating index on pillar_id...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_habits_pillar_id ON habits(pillar_id)")
            print("  ✅ Index created")
        
        if needs_category:
            print("  📝 Creating index on category_id...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_habits_category_id ON habits(category_id)")
            print("  ✅ Index created")
        
        conn.commit()
        print("\n🎉 Migration completed successfully!")
        print("\n📊 Current habits table schema:")
        cursor.execute("PRAGMA table_info(habits)")
        for col in cursor.fetchall():
            print(f"  - {col[1]} ({col[2]})")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
