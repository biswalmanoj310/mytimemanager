# Quick Start: Settings Page Usage

## Accessing Settings
1. Open MyTimeManager app (http://localhost:3000)
2. Click "⚙️ Settings" in the sidebar navigation
3. You'll see the Settings page with your current profile

## Understanding the Settings Page

### Current Profile Card (Top)
- **Green card** = You're on production (your personal data) ✅ SAFE
- **Orange card** = You're on test profile (family member's data) ⚠️ TEST MODE
- **Safety Badge**: Green checkmark means production is backed up

### All Profiles Grid
- **production** - Your personal database (main data)
- **{name}_test** - Test databases (imported from family members)
- **Blue border** = Currently active profile
- **Switch button** = Click to change profiles
- **Delete button** = Remove test profiles (production can't be deleted)

## Common Workflows

### Workflow 1: Import Daughter's Database
```bash
# On your laptop (after getting daughter's backup file)
cd /Users/mbiswal/projects/mytimemanager
./import_database.sh daughter ~/mytimemanager_backups/daughter_backup.db.gz
```

Then in Settings page:
1. Refresh the page → see "daughter_test" profile card
2. Click "Switch" on daughter_test card
3. Confirm the switch → app reloads
4. You're now working with daughter's data (orange card at top)

### Workflow 2: Test Bug Fix
1. Switch to daughter_test profile (see Workflow 1)
2. Reproduce the bug she reported
3. Fix the code and test
4. When done, click "Switch" on production card
5. Confirm → back to your personal data

### Workflow 3: Rollback If Needed
If something goes wrong while testing:
1. Click "Switch" on production card
2. Confirm switch
3. You're back to your safe production data
4. Test database is still preserved - you can switch back anytime

### Workflow 4: Clean Up Test Profiles
After fixing bug and deploying to daughter:
1. Switch to production (if not already)
2. Click "Delete" button on daughter_test card
3. Confirm deletion
4. Test profile removed, frees up disk space

## Safety Guarantees

✅ **First Switch Protection**: When you first switch from production, automatic backup created
✅ **Visual Warnings**: Orange card clearly shows when you're on test data
✅ **Production Lock**: Cannot delete production database from UI
✅ **Active Profile Lock**: Cannot delete currently active profile
✅ **Confirmation Dialogs**: Critical operations require confirmation
✅ **Auto-Reload**: App reloads after switch to ensure clean state

## Color Guide
- **Green** 🟢 = Production (safe, your data)
- **Orange** 🟠 = Test profile (family member data)
- **Blue** 🔵 = Currently active profile (border)
- **Gray** ⚪ = Inactive profile (available to switch)

## Import Command Reference
```bash
# Import daughter's backup
./import_database.sh daughter ~/mytimemanager_backups/daughter_backup.db.gz

# Import wife's backup
./import_database.sh wife ~/mytimemanager_backups/wife_backup.db.gz

# General format
./import_database.sh {profile_name} {path_to_backup.db.gz}
```

## Troubleshooting

### Profile not showing after import?
- Refresh the Settings page (browser reload)
- Check terminal for import success message
- Verify database file exists: `ls -lh backend/database/mytimemanager_*_test.db`

### Can't switch profiles?
- Make sure you're not trying to switch to already active profile
- Check browser console for errors (F12)
- Backend must be running (http://localhost:8000/docs should work)

### App doesn't reload after switch?
- Wait 2 seconds (auto-reload delay)
- If still not reloaded, manually refresh browser (Cmd+R)
- Check backend logs for switch success

### Want to see all profiles in terminal?
```bash
cd /Users/mbiswal/projects/mytimemanager/backend/database
ls -lh mytimemanager*.db
```

## Next Steps After Testing
1. Fix bugs in your production database
2. Create backup: `./backup_database.sh`
3. Transfer backup to daughter's laptop
4. She imports as her production database
5. Repeat for wife's laptop
6. Both use separate instances with their own data

## Tips
- **Keep production clean**: Only switch to test profiles for specific bug testing
- **Document changes**: Note what you fixed while on test profile
- **Regular backups**: Run `./backup_database.sh` before major changes
- **Clean up**: Delete test profiles after deployment to save space
- **Visual confirmation**: Always check the orange card when testing - ensures you're not accidentally modifying production

## Keyboard Shortcuts
- None currently - use mouse to click buttons
- Future: Cmd+Shift+P for quick profile switcher?

## API Endpoints (for advanced users)
If you prefer using curl or Postman:
```bash
# List all profiles
curl http://localhost:8000/api/profiles

# Get current profile
curl http://localhost:8000/api/profiles/current

# Switch profile
curl -X POST http://localhost:8000/api/profiles/switch/daughter_test

# Delete test profile
curl -X DELETE http://localhost:8000/api/profiles/daughter_test
```

## Help
If something goes wrong:
1. Switch back to production immediately
2. Check `SETTINGS_PAGE_COMPLETE.md` for technical details
3. Check `MULTI_INSTANCE_WORKFLOW.md` for deployment strategy
4. Your production backup is safe at: `~/mytimemanager_backups/`
