"""
Database initialization script
Run this to create the database and populate initial data
"""

import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.config import init_db, SessionLocal
from app.models.models import Pillar, MotivationalQuote


def create_initial_pillars():
    """Create the three pillars with default configuration"""
    db = SessionLocal()
    try:
        # Check if pillars already exist
        existing_pillars = db.query(Pillar).count()
        if existing_pillars > 0:
            print("⚠️  Pillars already exist. Skipping initial data creation.")
            return

        # Create the three pillars
        pillars = [
            Pillar(
                name="Hard Work",
                description="Professional development, career growth, and productive work",
                allocated_hours=8.0,
                color_code="#3B82F6",  # Blue
                icon="💼"
            ),
            Pillar(
                name="Calmness",
                description="Rest, meditation, self-care, and mental well-being",
                allocated_hours=8.0,
                color_code="#10B981",  # Green
                icon="🧘"
            ),
            Pillar(
                name="Family",
                description="Relationships, personal connections, and family time",
                allocated_hours=8.0,
                color_code="#F59E0B",  # Amber
                icon="👨‍👩‍👧‍👦"
            )
        ]

        for pillar in pillars:
            db.add(pillar)
        
        db.commit()
        print("✅ Three pillars created successfully!")
        
    except Exception as e:
        print(f"❌ Error creating pillars: {e}")
        db.rollback()
    finally:
        db.close()


def create_initial_quotes():
    """Create initial motivational quotes"""
    db = SessionLocal()
    try:
        # Check if quotes already exist
        existing_quotes = db.query(MotivationalQuote).count()
        if existing_quotes > 0:
            print("⚠️  Quotes already exist. Skipping initial quotes creation.")
            return

        quotes = [
            MotivationalQuote(
                quote="CANI: Constant And Never-ending Improvement. Commit to improving 1% every day.",
                author="Tony Robbins",
                category="cani"
            ),
            MotivationalQuote(
                quote="The key to success is to focus on goals, not obstacles.",
                author="Unknown",
                category="motivation"
            ),
            MotivationalQuote(
                quote="Time is what we want most, but what we use worst.",
                author="William Penn",
                category="time-management"
            ),
            MotivationalQuote(
                quote="The way to get started is to quit talking and begin doing.",
                author="Walt Disney",
                category="motivation"
            ),
            MotivationalQuote(
                quote="Balance is not something you find, it's something you create.",
                author="Jana Kingsford",
                category="balance"
            ),
            MotivationalQuote(
                quote="Success is the sum of small efforts repeated day in and day out.",
                author="Robert Collier",
                category="cani"
            ),
            MotivationalQuote(
                quote="Your time is limited, don't waste it living someone else's life.",
                author="Steve Jobs",
                category="time-management"
            ),
            MotivationalQuote(
                quote="The secret of getting ahead is getting started.",
                author="Mark Twain",
                category="motivation"
            ),
            MotivationalQuote(
                quote="Take care of your body. It's the only place you have to live.",
                author="Jim Rohn",
                category="balance"
            ),
            MotivationalQuote(
                quote="The best time to plant a tree was 20 years ago. The second best time is now.",
                author="Chinese Proverb",
                category="motivation"
            )
        ]

        for quote in quotes:
            db.add(quote)
        
        db.commit()
        print("✅ Motivational quotes created successfully!")
        
    except Exception as e:
        print(f"❌ Error creating quotes: {e}")
        db.rollback()
    finally:
        db.close()


def main():
    """Main initialization function"""
    print("🚀 Initializing MyTimeManager Database...")
    print("=" * 50)
    
    # Create all tables
    print("\n📊 Creating database tables...")
    init_db()
    
    # Create initial data
    print("\n📝 Creating initial pillars...")
    create_initial_pillars()
    
    print("\n💭 Creating motivational quotes...")
    create_initial_quotes()
    
    print("\n" + "=" * 50)
    print("✨ Database initialization complete!")
    print("\n📋 Summary:")
    print("   - Database tables created")
    print("   - Three pillars initialized (Hard Work, Calmness, Family)")
    print("   - Motivational quotes added")
    print("\n🎯 Ready to start managing your time!")


if __name__ == "__main__":
    main()
