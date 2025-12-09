"""
Migration: Add parent_id to important_tasks table for sub-task support
Also add start_date field to track when task was created
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.database.config import DATABASE_URL

def run_migration():
    """Add parent_id and start_date columns to important_tasks table"""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if parent_id column exists
        result = conn.execute(text("PRAGMA table_info(important_tasks)"))
        columns = [row[1] for row in result]
        
        if 'parent_id' not in columns:
            print("Adding parent_id column to important_tasks...")
            conn.execute(text("""
                ALTER TABLE important_tasks 
                ADD COLUMN parent_id INTEGER REFERENCES important_tasks(id) ON DELETE CASCADE
            """))
            conn.commit()
            print("✓ Added parent_id column")
        else:
            print("✓ parent_id column already exists")
        
        # Check if start_date column exists
        result = conn.execute(text("PRAGMA table_info(important_tasks)"))
        columns = [row[1] for row in result]
        
        if 'start_date' not in columns:
            print("Adding start_date column to important_tasks...")
            conn.execute(text("""
                ALTER TABLE important_tasks 
                ADD COLUMN start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            """))
            conn.commit()
            print("✓ Added start_date column")
        else:
            print("✓ start_date column already exists")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
