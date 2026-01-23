# Safe Multi-Instance Development Workflow

## 🎯 Problem Solved
You use your laptop for BOTH:
- **Development** - Making code changes, testing new features
- **Production** - Your real daily time tracking data

This workflow keeps YOUR data safe while testing daughter's/wife's bugs.

---

## 📊 Database Profiles

Your laptop has multiple databases:

```
backend/database/
├── mytimemanager.db              # Active database (switches based on profile)
├── mytimemanager_production.db   # YOUR data (always safe)
├── daughter_test.db              # Daughter's data copy for testing
└── wife_test.db                  # Wife's data copy for testing
```

---

## 🔄 Typical Bug Fix Workflow

### **Scenario: Daughter reports a bug**

#### Step 1: Get Her Database
```bash
# Daughter runs on her laptop:
./backup_database.sh

# She sends you: ~/mytimemanager_backups/mytimemanager_backup_20260123_104530.db.gz
# Via: WhatsApp, Email, USB, or network copy
```

#### Step 2: Import to Your Laptop
```bash
# On your laptop:
./import_database.sh daughter ~/Downloads/daughter_backup_20260123.db.gz

# Output:
# ✅ Database imported successfully!
# Next steps:
#   1. Switch to daughter:  ./switch_profile.sh daughter
#   2. Restart backend:     ./start_backend.sh
```

#### Step 3: Switch to Daughter's Profile
```bash
./switch_profile.sh daughter

# Output:
# 🔄 Switching to profile: daughter
# ✅ Switched to daughter test data
# ⚠️  Your production data is safe at: mytimemanager_production.db
# 
# 💡 Restart backend to apply changes: ./start_backend.sh
```

#### Step 4: Restart Backend
```bash
./start_backend.sh

# Now you're running daughter's data
# Frontend at http://localhost:3000 shows her tasks/habits
```

#### Step 5: Reproduce & Fix Bug
```bash
# Navigate to the bug in UI
# Make code changes
# Test thoroughly

# When fixed, commit:
git add -A
git commit -m "Fix: Issue with habit streak calculation"
git push origin main
```

#### Step 6: Switch Back to YOUR Data
```bash
./switch_profile.sh production

# Output:
# ✅ Switched to YOUR production data
# 
# 💡 Restart backend to apply changes: ./start_backend.sh

./start_backend.sh

# Now you're back to YOUR data
# Continue your daily tracking
```

#### Step 7: Deploy Fix to Daughter
```bash
# On daughter's laptop (or she does it):
cd /path/to/mytimemanager
git pull origin main

# If migration needed:
cd backend/migrations
python3 025_fix_bug.py

# Restart
./start_app.sh
```

---

## 🚀 Quick Reference Commands

### Check Current Profile
```bash
./switch_profile.sh
# Shows: Current Profile: production (YOU)
```

### List All Profiles
```bash
./switch_profile.sh
# Shows:
#   production     - Your personal data (default)
#   daughter       - Test database (816 KB)
#   wife           - Test database (512 KB)
```

### Switch Between Profiles
```bash
./switch_profile.sh daughter     # Test with daughter's data
./switch_profile.sh wife          # Test with wife's data
./switch_profile.sh production    # Back to YOUR data
```

### Import New Database
```bash
./import_database.sh daughter ~/Downloads/latest_backup.db.gz
```

---

## ⚠️ Safety Features

### Your Data is ALWAYS Safe
1. ✅ First switch creates permanent backup: `mytimemanager_production.db`
2. ✅ Switching profiles NEVER modifies production backup
3. ✅ Can always return: `./switch_profile.sh production`

### Visual Indicators
```bash
# Terminal shows current profile:
📊 Current Profile: daughter

# Add to your .bashrc for constant reminder:
export PS1="\[\e[33m\][DB:$(cat ~/projects/mytimemanager/.current_profile 2>/dev/null || echo 'prod')]\[\e[0m\] $PS1"
```

### Backup Before Major Changes
```bash
# Always backup before risky operations:
./backup_database.sh

# Creates timestamped backup in ~/mytimemanager_backups/
```

---

## 🎯 Development Best Practices

### Testing New Features
```bash
# Option 1: Use throwaway sandbox
./import_database.sh sandbox backend/database/mytimemanager_production.db
./switch_profile.sh sandbox
# Test feature, delete data, don't care

# Option 2: Use daughter's data (if relevant to her use case)
./switch_profile.sh daughter
# Test with realistic data
```

### Before Deploying to Family
```bash
# Always test migrations on test database first:
./switch_profile.sh daughter
cd backend/migrations
python3 026_new_migration.py

# If successful, deploy to production
./switch_profile.sh production
python3 026_new_migration.py

# Then push code
git push origin main
```

---

## 🔍 Troubleshooting

### "I'm in daughter's profile, how do I get back?"
```bash
./switch_profile.sh production
./start_backend.sh
```

### "I accidentally modified production while in daughter's profile"
```bash
# Your production backup is untouched!
./switch_profile.sh production  # Restores from mytimemanager_production.db
```

### "I want to update daughter's test database with new backup"
```bash
./import_database.sh daughter ~/Downloads/new_backup.db.gz
# Overwrites old daughter_test.db
```

### "Where is my production data?"
```bash
ls -lh backend/database/

# You should see:
# mytimemanager.db              - Active (switches based on profile)
# mytimemanager_production.db   - YOUR data (always safe)
```

---

## 📝 Profile Management Tips

### Create Profile for Testing
```bash
# Copy your data to create test profile
cp backend/database/mytimemanager.db backend/database/sandbox_test.db

./switch_profile.sh sandbox
# Now you can mess with data without fear
```

### Delete Old Profiles
```bash
rm backend/database/old_profile_test.db
```

### Share Test Database with Another Dev
```bash
# Export current profile
gzip -c backend/database/mytimemanager.db > share_db.db.gz

# They import:
./import_database.sh shared_db share_db.db.gz
```

---

## 🎉 Benefits

✅ **Your data stays safe** - Production backup never touched  
✅ **Easy testing** - Switch to any profile in seconds  
✅ **Realistic debugging** - Test with actual user data  
✅ **Quick rollback** - Switch back to production anytime  
✅ **Multiple test environments** - Daughter, wife, sandbox, etc.  
✅ **No complex setup** - Just shell scripts, no Docker/VMs  

---

## 🚀 Next: Deploy to Family

When ready to deploy:

1. ✅ Test with their data locally (using profiles)
2. ✅ Fix any bugs found
3. ✅ Push to GitHub
4. ✅ They pull updates on their laptops
5. ✅ Import new backups from them as needed

**Your production data is always safe!** 🎯
