#!/bin/bash
cd "$(dirname "$0")/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
