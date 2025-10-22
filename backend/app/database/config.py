"""
Database configuration and session management.
Supports SQLite by default with easy migration path to PostgreSQL/MySQL.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get the project root directory (parent of backend)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_DIR = os.path.join(PROJECT_ROOT, "database")

# Ensure database directory exists
os.makedirs(DATABASE_DIR, exist_ok=True)

# Get database URL from environment with proper absolute path
DEFAULT_DB_PATH = os.path.join(DATABASE_DIR, "mytimemanager.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Create engine
# For SQLite, add check_same_thread=False
# For PostgreSQL/MySQL, this parameter is ignored
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=True  # Set to False in production
    )
else:
    # PostgreSQL/MySQL configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=True  # Set to False in production
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


# Dependency to get database session
def get_db():
    """
    Dependency function to get database session.
    Use this in FastAPI endpoints with Depends(get_db).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables.
    This should be called on application startup.
    """
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized successfully!")


def reset_db():
    """
    Reset database - drop all tables and recreate.
    WARNING: This will delete all data! Use only in development.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("⚠️  Database reset completed!")
