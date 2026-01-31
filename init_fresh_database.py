#!/usr/bin/env python3
"""
Initialize a fresh database with schema but no data.
Use this for new installations where you want to start fresh.
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_dir))

from app.database.config import Base, engine
from app.models.models import *
from app.models.goal import *

def init_fresh_database():
    """Create all tables from scratch"""
    try:
        # Create all tables
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✓ All tables created successfully!")
        print(f"✓ Database initialized at: backend/database/mytimemanager.db")
        print("\nYou can now start using the application!")
        return True
    except Exception as e:
        print(f"✗ Error creating database: {e}")
        return False

if __name__ == "__main__":
    db_path = Path("backend/database/mytimemanager.db")
    
    if db_path.exists():
        response = input(f"⚠️  Database already exists at {db_path}\nDo you want to DELETE it and start fresh? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted. Existing database preserved.")
            sys.exit(0)
        else:
            db_path.unlink()
            print("✓ Old database deleted.")
    
    # Ensure database directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    success = init_fresh_database()
    sys.exit(0 if success else 1)
