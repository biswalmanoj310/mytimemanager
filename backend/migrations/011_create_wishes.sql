-- Migration 011: Create Wishes (Dream Board / Someday Maybe List)
-- Based on philosophy: Wishes → Aspirational Goals → Committed Goals

-- Create wishes table
CREATE TABLE IF NOT EXISTS wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- travel, financial, personal, career, health, relationship, learning, lifestyle
    dream_type VARCHAR(50), -- experience, acquisition, achievement, transformation
    
    -- Aspirational details (rough ideas, no pressure)
    estimated_timeframe VARCHAR(50), -- someday, 1-2 years, 2-5 years, 5+ years
    estimated_cost DECIMAL(12, 2),
    priority VARCHAR(20) DEFAULT 'low', -- low, medium, high, burning_desire
    
    -- Emotional connection (Viktor Frankl: "Know your why")
    why_important TEXT, -- Why does this matter to me?
    emotional_impact TEXT, -- How will I feel when achieved?
    life_area VARCHAR(50), -- Which life pillar does this align with?
    
    -- Visual inspiration
    image_url TEXT,
    inspiration_notes TEXT,
    
    -- Related to existing system
    pillar_id INTEGER,
    category_id INTEGER,
    related_goal_id INTEGER, -- If converted to life goal
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'dreaming', -- dreaming, exploring, planning, ready_to_commit, converted, archived
    converted_to_goal_at TIMESTAMP,
    
    -- Metadata
    is_active BOOLEAN DEFAULT 1,
    is_private BOOLEAN DEFAULT 0, -- Some wishes are deeply personal
    tags TEXT, -- JSON array of tags for flexible categorization
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pillar_id) REFERENCES pillars(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (related_goal_id) REFERENCES life_goals(id) ON DELETE SET NULL
);

-- Create wish reflections table (journaling about wishes)
CREATE TABLE IF NOT EXISTS wish_reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wish_id INTEGER NOT NULL,
    reflection_date DATE NOT NULL,
    reflection_text TEXT NOT NULL,
    mood VARCHAR(50), -- excited, uncertain, determined, doubtful, inspired
    clarity_score INTEGER, -- 1-10, how clear is this wish becoming?
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE
);

-- Create wish milestones table (small steps toward exploring the wish)
CREATE TABLE IF NOT EXISTS wish_exploration_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wish_id INTEGER NOT NULL,
    step_title VARCHAR(255) NOT NULL,
    step_description TEXT,
    step_type VARCHAR(50), -- research, save_money, learn_skill, explore, connect
    
    is_completed BOOLEAN DEFAULT 0,
    completed_at TIMESTAMP,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE
);

-- Create wish inspirations table (collect inspiring content)
CREATE TABLE IF NOT EXISTS wish_inspirations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wish_id INTEGER NOT NULL,
    inspiration_type VARCHAR(50), -- article, video, photo, quote, story, person
    title VARCHAR(255),
    url TEXT,
    content_text TEXT,
    source VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wishes_status ON wishes(status);
CREATE INDEX IF NOT EXISTS idx_wishes_category ON wishes(category);
CREATE INDEX IF NOT EXISTS idx_wishes_pillar ON wishes(pillar_id);
CREATE INDEX IF NOT EXISTS idx_wishes_active ON wishes(is_active);
CREATE INDEX IF NOT EXISTS idx_wish_reflections_wish ON wish_reflections(wish_id);
CREATE INDEX IF NOT EXISTS idx_wish_steps_wish ON wish_exploration_steps(wish_id);
CREATE INDEX IF NOT EXISTS idx_wish_inspirations_wish ON wish_inspirations(wish_id);
