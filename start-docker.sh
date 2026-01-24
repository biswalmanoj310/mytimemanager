#!/bin/bash
# MyTimeManager Docker Startup Script for Mac/Linux
# This script starts the application using Docker

echo "========================================"
echo " MyTimeManager - Docker Startup"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    echo ""
    echo "Please install Docker Desktop from:"
    echo "https://www.docker.com/products/docker-desktop"
    echo ""
    exit 1
fi

echo "[1/3] Building Docker images..."
docker-compose build

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to build Docker images"
    exit 1
fi

echo ""
echo "[2/3] Starting containers..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to start containers"
    exit 1
fi

echo ""
echo "[3/3] Waiting for services to be ready..."
sleep 5

echo ""
echo "========================================"
echo " SUCCESS! MyTimeManager is running!"
echo "========================================"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Open your browser and go to:"
echo "  http://localhost:3000"
echo ""
echo "To stop the app, run: ./stop-docker.sh"
echo "To view logs, run:    docker-compose logs -f"
echo ""
