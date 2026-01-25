@echo off
echo ========================================
echo MyTimeManager - Initialize Database
echo ========================================
echo.
echo This will create all database tables...
echo.

echo [1/2] Creating database tables...
docker exec mytimemanager-backend python -c "from app.database.config import Base, engine; from app.models import models, goal; Base.metadata.create_all(bind=engine); print('✓ All tables created successfully!')"

echo.
echo [2/2] Verifying database...
docker exec mytimemanager-backend python -c "from app.database.config import SessionLocal; from sqlalchemy import text; db = SessionLocal(); count = len(db.execute(text('SELECT name FROM sqlite_master WHERE type=\"table\"')).fetchall()); print(f'✓ Database initialized! Tables count: {count}'); db.close()"

echo.
echo ========================================
echo Database initialization complete!
echo You can now use the app at http://localhost:3000
echo ========================================
pause
