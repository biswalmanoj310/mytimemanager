#!/bin/bash

# Setup Script - Make all scripts executable

echo "Setting up Time Manager scripts..."

# Make scripts executable
chmod +x backup_database.sh
chmod +x restore_database.sh
chmod +x start_app.sh
chmod +x start_all.sh
chmod +x start_backend.sh
chmod +x start_frontend.sh
chmod +x setup.sh

echo "✓ All scripts are now executable"
echo ""
echo "Available commands:"
echo "  ./start_app.sh          - Start the application"
echo "  ./backup_database.sh    - Create database backup"
echo "  ./restore_database.sh   - Restore from backup"
echo ""
echo "Read BACKUP_GUIDE.md for detailed instructions"
