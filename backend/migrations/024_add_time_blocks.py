"""
Migration 024: Add Time Blocks Configuration
Adds support for custom time block display preferences
"""

import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'mytimemanager.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Creating time_block_configs table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS time_block_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_name TEXT NOT NULL,
                config_name TEXT NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                time_format TEXT DEFAULT '24h',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(profile_name, config_name)
            )
        """)
        
        print("Creating time_blocks table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS time_blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id INTEGER NOT NULL,
                block_order INTEGER NOT NULL,
                start_hour INTEGER NOT NULL,
                end_hour INTEGER NOT NULL,
                label TEXT,
                color_code TEXT DEFAULT '#3b82f6',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (config_id) REFERENCES time_block_configs(id) ON DELETE CASCADE
            )
        """)
        
        print("Creating default 24-hour config for production profile...")
        cursor.execute("""
            INSERT OR IGNORE INTO time_block_configs 
            (profile_name, config_name, is_active, time_format) 
            VALUES ('production', 'Standard 24-hour', 1, '24h')
        """)
        
        conn.commit()
        print("✓ Migration 024 completed successfully!")
        print("  - time_block_configs table created")
        print("  - time_blocks table created")
        print("  - Default config created for production profile")
        
    except sqlite3.OperationalError as e:
        if "already exists" in str(e).lower():
            print("⚠ Tables already exist, skipping...")
        else:
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
