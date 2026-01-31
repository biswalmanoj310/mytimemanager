#!/bin/bash

# Initialize fresh database for new user
# This creates all tables but no data

echo "========================================"
echo "Initialize Fresh Database"
echo "========================================"
echo ""

# Check if running in Docker or direct
if [ -f "/.dockerenv" ]; then
    # Inside Docker container
    python /app/init_fresh_database.py
else
    # Direct on host - need to activate venv
    if [ ! -d "backend/venv" ]; then
        echo "Setting up Python virtual environment..."
        cd backend
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        cd ..
    else
        source backend/venv/bin/activate
    fi
    
    python init_fresh_database.py
fi

echo ""
echo "========================================"
echo "Initialization Complete!"
echo "========================================"
