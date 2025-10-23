"""
Main FastAPI application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="MyTimeManager API",
    description="Time and Task Management API based on CANI concept",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to MyTimeManager API",
        "version": "1.0.0",
        "pillars": ["Hard Work", "Calmness", "Family"],
        "philosophy": "CANI - Constant And Never-ending Improvement"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "sqlite",
        "message": "MyTimeManager is running!"
    }


# Import and include routers
from app.routes import pillars, categories, sub_categories, tasks, goals, dashboard, time_entries, analytics, calendar, comparative_analytics, daily_time, weekly_time

app.include_router(pillars.router, prefix="/api/pillars", tags=["Pillars"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(sub_categories.router, prefix="/api/sub-categories", tags=["Sub-Categories"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(goals.router, prefix="/api/goals", tags=["Goals"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(time_entries.router, prefix="/api/time-entries", tags=["Time Entries"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(comparative_analytics.router)
app.include_router(daily_time.router)
app.include_router(weekly_time.router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
