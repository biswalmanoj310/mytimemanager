"""
Database Profile Management API
Allows switching between production and test databases safely
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional
import os
import shutil
from datetime import datetime
from pathlib import Path

router = APIRouter()

# Database paths
DB_DIR = Path(__file__).parent.parent / "database"
CURRENT_DB = DB_DIR / "mytimemanager.db"
PRODUCTION_DB = DB_DIR / "mytimemanager_production.db"
PROFILE_FILE = Path(__file__).parent.parent.parent / ".current_profile"


@router.get("/profiles")
def list_profiles() -> Dict:
    """List all available database profiles"""
    profiles = []
    
    # Production profile (always available)
    if PRODUCTION_DB.exists():
        size = PRODUCTION_DB.stat().st_size / 1024  # KB
        profiles.append({
            "name": "production",
            "display_name": "Your Data (Production)",
            "size_kb": round(size, 2),
            "is_current": get_current_profile() == "production"
        })
    
    # Test profiles
    for db_file in DB_DIR.glob("*_test.db"):
        name = db_file.stem.replace("_test", "")
        size = db_file.stat().st_size / 1024  # KB
        profiles.append({
            "name": name,
            "display_name": f"{name.title()}'s Data (Test)",
            "size_kb": round(size, 2),
            "is_current": get_current_profile() == name
        })
    
    return {
        "current_profile": get_current_profile(),
        "profiles": profiles
    }


@router.post("/switch/{profile_name}")
def switch_profile(profile_name: str) -> Dict:
    """Switch to a different database profile"""
    
    if profile_name == "production":
        # Switch back to production
        if not PRODUCTION_DB.exists():
            # First time - create production backup
            shutil.copy(CURRENT_DB, PRODUCTION_DB)
        
        shutil.copy(PRODUCTION_DB, CURRENT_DB)
        set_current_profile("production")
        
        return {
            "success": True,
            "message": "Switched to YOUR production data",
            "current_profile": "production",
            "warning": None
        }
    else:
        # Switch to test profile
        test_db = DB_DIR / f"{profile_name}_test.db"
        
        if not test_db.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Profile '{profile_name}' not found. Import database first."
            )
        
        # Backup production if first time
        if not PRODUCTION_DB.exists():
            shutil.copy(CURRENT_DB, PRODUCTION_DB)
        
        # Switch to test database
        shutil.copy(test_db, CURRENT_DB)
        set_current_profile(profile_name)
        
        return {
            "success": True,
            "message": f"Switched to {profile_name}'s test data",
            "current_profile": profile_name,
            "warning": "⚠️ This is test data. Your production data is safe."
        }


@router.get("/current")
def get_current_profile_info() -> Dict:
    """Get information about current profile"""
    current = get_current_profile()
    
    size_kb = CURRENT_DB.stat().st_size / 1024 if CURRENT_DB.exists() else 0
    
    return {
        "profile": current,
        "display_name": "Your Data (Production)" if current == "production" else f"{current.title()}'s Data (Test)",
        "size_kb": round(size_kb, 2),
        "is_production": current == "production",
        "production_backup_exists": PRODUCTION_DB.exists()
    }


@router.post("/import")
def import_profile(profile_name: str, backup_path: str) -> Dict:
    """Import a database backup as a test profile"""
    
    backup_file = Path(backup_path)
    
    if not backup_file.exists():
        raise HTTPException(status_code=404, detail=f"Backup file not found: {backup_path}")
    
    test_db = DB_DIR / f"{profile_name}_test.db"
    
    # Handle compressed files
    if backup_file.suffix == ".gz":
        import gzip
        with gzip.open(backup_file, 'rb') as f_in:
            with open(test_db, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    else:
        shutil.copy(backup_file, test_db)
    
    return {
        "success": True,
        "message": f"Database imported for profile: {profile_name}",
        "profile": profile_name,
        "size_kb": round(test_db.stat().st_size / 1024, 2)
    }


@router.delete("/profiles/{profile_name}")
def delete_profile(profile_name: str) -> Dict:
    """Delete a test profile"""
    
    if profile_name == "production":
        raise HTTPException(status_code=400, detail="Cannot delete production profile")
    
    test_db = DB_DIR / f"{profile_name}_test.db"
    
    if not test_db.exists():
        raise HTTPException(status_code=404, detail=f"Profile not found: {profile_name}")
    
    # Don't delete if currently active
    if get_current_profile() == profile_name:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete active profile. Switch to production first."
        )
    
    test_db.unlink()
    
    return {
        "success": True,
        "message": f"Profile '{profile_name}' deleted"
    }


# Helper functions
def get_current_profile() -> str:
    """Get the currently active profile"""
    if PROFILE_FILE.exists():
        return PROFILE_FILE.read_text().strip()
    return "production"


def set_current_profile(profile: str):
    """Set the current profile"""
    PROFILE_FILE.write_text(profile)
