"""
Migration: Add related_wish_id to life_goals table
Enables linking life goals to dreams/wishes
"""
import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(life_goals)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'related_wish_id' not in columns:
            print("Adding related_wish_id column to life_goals table...")
            cursor.execute("""
                ALTER TABLE life_goals 
                ADD COLUMN related_wish_id INTEGER 
                REFERENCES wishes(id) ON DELETE SET NULL
            """)
            conn.commit()
            print("✓ Migration completed successfully!")
        else:
            print("⚠ Column 'related_wish_id' already exists, skipping...")
            
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠ Column already exists, skipping...")
        else:
            print(f"❌ Error: {e}")
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
