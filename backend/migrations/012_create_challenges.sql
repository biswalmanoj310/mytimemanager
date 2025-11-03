-- Migration: Create Challenges Feature Tables
-- Date: 2025-10-31
-- Purpose: Add time-bound personal challenges (7-30 day experiments)

-- Main challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL CHECK(challenge_type IN ('daily_streak', 'count_based', 'accumulation')),
    
    -- Challenge Parameters
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_days INTEGER, -- For daily_streak: number of days
    target_count INTEGER, -- For count_based: number of times to do
    target_value REAL, -- For accumulation: total to achieve
    unit TEXT, -- 'fruits', 'treks', 'km', 'pages', etc.
    
    -- Tracking
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    completed_days INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,
    current_value REAL DEFAULT 0.0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed', 'abandoned')),
    is_completed BOOLEAN DEFAULT 0,
    completion_date DATE,
    
    -- Gamification
    difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
    reward TEXT, -- Optional: What you get for completing
    why_reason TEXT, -- Why are you doing this challenge?
    
    -- Links
    pillar_id INTEGER,
    can_graduate_to_habit BOOLEAN DEFAULT 0, -- Can this become a permanent habit?
    graduated_habit_id INTEGER, -- Reference to habit if graduated
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pillar_id) REFERENCES pillars (id) ON DELETE SET NULL
);

-- Daily entries for challenges
CREATE TABLE IF NOT EXISTS challenge_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    
    -- Entry Data
    is_completed BOOLEAN DEFAULT 0, -- Did you do it today?
    count_value INTEGER DEFAULT 0, -- For count_based: how many times
    numeric_value REAL DEFAULT 0.0, -- For accumulation: how much
    
    -- Optional
    note TEXT,
    mood TEXT CHECK(mood IN ('great', 'good', 'okay', 'struggled')), -- How did you feel?
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (challenge_id) REFERENCES challenges (id) ON DELETE CASCADE,
    UNIQUE(challenge_id, entry_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_start_date ON challenges(start_date);
CREATE INDEX IF NOT EXISTS idx_challenges_end_date ON challenges(end_date);
CREATE INDEX IF NOT EXISTS idx_challenges_pillar ON challenges(pillar_id);

CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge ON challenge_entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_date ON challenge_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_completed ON challenge_entries(is_completed);
