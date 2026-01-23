# Settings Page - Database Profile Management

## Overview
Implemented web-based UI for database profile management, replacing command-line scripts with a user-friendly Settings page. This enables safe testing of bugs from family members without risking production data.

## Problem Solved
**User Constraint**: Development laptop is ALSO production environment with personal data
**User Need**: Test bugs reported by daughter/wife using their data WITHOUT overwriting personal database
**Previous Solution**: Shell scripts (`switch_profile.sh`, `import_database.sh`) - too technical
**New Solution**: Settings page with visual profile cards and one-click switching

## Implementation

### Backend API (`backend/app/routes/profiles.py`)
Created REST API with 5 endpoints:

1. **GET /api/profiles** - List all available profiles
   - Returns: Array of profiles (production + test databases)
   - Each profile includes: name, type (production/test), size, last_modified, is_active
   
2. **POST /api/profiles/switch/{profile_name}** - Switch active database
   - Auto-creates backup of production database on first switch
   - Updates symlink to point to selected database
   - Returns: Success message with new profile info
   
3. **GET /api/profiles/current** - Get current profile information
   - Returns: Current profile details + production backup status
   
4. **POST /api/profiles/import** - Import backup as new test profile
   - Accepts: File upload (gzipped backup)
   - Creates: New test profile from backup
   - Returns: New profile details
   
5. **DELETE /api/profiles/{profile_name}** - Delete test profile
   - Validates: Cannot delete production or active profile
   - Removes: Test database file
   - Returns: Success message

### Frontend UI (`frontend/src/pages/Settings.tsx`)
Complete Settings page with:

**Current Profile Section**:
- Large card showing active profile
- Visual indicators: Green gradient for production, orange for test
- Production backup status badge (green checkmark when safe)
- Warning message when on test profile

**All Profiles Grid**:
- Cards for each available database profile
- Shows: Profile name, type badge, size, last modified date
- Active profile highlighted with blue border
- Switch button for inactive profiles (with confirmation dialog)
- Delete button for test profiles (production cannot be deleted)

**Import Instructions**:
- Step-by-step guide for importing family member backups
- Command examples with proper formatting
- Workflow tips for debugging → testing → rollback

**Safety Features**:
- Auto-reload after profile switch (2-second delay)
- Confirmation dialogs for critical operations
- Visual warnings when working with test data
- Production backup indicator shows safety status

### Styling (`frontend/src/pages/Settings.css`)
Professional styling with:
- Color-coded profiles (green=production, orange=test)
- Responsive grid layout (300px min column width)
- Message banners (success/warning/error with color coding)
- Safety indicator badges
- Mobile-responsive design (768px breakpoint)

### Integration
- Added Settings route to `App.tsx`: `/settings`
- Added Settings link to sidebar navigation in `Layout.tsx`
- Settings icon from lucide-react library
- Accessible from main navigation menu

## Usage Workflow

### Testing Daughter's Bug:
1. Get daughter's database backup: `~/mytimemanager_backups/daughter_backup.db.gz`
2. Go to Settings page → Import section
3. Run import command: `./import_database.sh daughter ~/mytimemanager_backups/daughter_backup.db.gz`
4. Refresh Settings page → see "daughter_test" profile card
5. Click "Switch" button → confirm → app reloads with daughter's data
6. Test and fix the bug
7. Click "Switch" back to "production" → confirm → back to personal data

### Safety Guarantees:
✅ Production database automatically backed up on first switch
✅ Visual indicator shows backup status (green checkmark)
✅ Cannot accidentally delete production database
✅ Clear warnings when working with test data
✅ One-click switch back to production data

### Multi-Instance Deployment:
Once bugs fixed in production database:
1. Create backup: `./backup_database.sh`
2. Transfer backup to daughter's laptop
3. She imports and uses as her production database
4. Repeat for wife's laptop

## Files Modified

### Backend:
- `backend/app/routes/profiles.py` - NEW (200+ lines) - Complete REST API
- `backend/app/main.py` - Added profiles router registration (line 100)

### Frontend:
- `frontend/src/pages/Settings.tsx` - NEW (150+ lines) - React component
- `frontend/src/pages/Settings.css` - NEW (300+ lines) - Styling
- `frontend/src/App.tsx` - Added Settings import and route
- `frontend/src/components/Layout.tsx` - Added Settings to navigation

## API Testing
Test endpoints at http://localhost:8000/docs:
- `/api/profiles` - See all available profiles
- `/api/profiles/current` - Check current profile
- `/api/profiles/switch/daughter_test` - Switch to test profile

## Next Steps
1. ✅ Settings page integrated into app navigation
2. ⏳ Test profile switching workflow
3. ⏳ Deploy to daughter's laptop
4. ⏳ Deploy to wife's laptop
5. ⏳ Update MULTI_INSTANCE_WORKFLOW.md with Settings page instructions

## Benefits Over CLI Scripts
- **Visual**: See all profiles at a glance with color coding
- **Safe**: Clear indicators for production backup status
- **Easy**: One-click switching with confirmation dialogs
- **Professional**: Better UX than command-line for non-technical users
- **Integrated**: No context switching - manage profiles from within app
- **Mobile-Ready**: Responsive design works on all screen sizes

## Technical Notes
- Profile switching updates symlink: `mytimemanager.db` → `mytimemanager_production.db` or `mytimemanager_*_test.db`
- Auto-reload after switch ensures all contexts refresh with new database
- Production backup created once: `mytimemanager_production_backup_YYYYMMDD_HHMMSS.db.gz`
- Test profiles named: `{name}_test.db` (e.g., `daughter_test.db`)
- All profile operations preserve data integrity (no accidental overwrites)
