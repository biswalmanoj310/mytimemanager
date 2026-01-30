import React, { useState, useEffect } from 'react';
import '../styles/PomodoroTree.css';

interface PomodoroTreeProps {
  onComplete?: () => void;
}

const PomodoroTree: React.FC<PomodoroTreeProps> = ({ onComplete }) => {
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const durationOptions = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];

  // Calculate progress (0-100)
  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  // Timer logic
  useEffect(() => {
    let interval: number | null = null;

    if (isRunning && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            if (onComplete) onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, onComplete]);

  const handleStart = () => {
    setIsRunning(true);
    setIsCompleted(false);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(duration * 60);
    setIsCompleted(false);
  };

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration);
    setTimeLeft(newDuration * 60);
    setIsRunning(false);
    setIsCompleted(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate which fruits should be visible based on progress
  const getFruitVisibility = () => {
    const fruitsCount = 5;
    const progressPerFruit = 100 / fruitsCount;
    return Array.from({ length: fruitsCount }, (_, i) => progress >= (i + 1) * progressPerFruit);
  };

  const fruits = getFruitVisibility();

  return (
    <>
    <div className="pomodoro-tree-container">
      <div className="pomodoro-header" onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <h3 style={{ fontSize: isCollapsed ? '15px' : '16px', margin: 0, whiteSpace: 'nowrap' }}>
          🍅 {isCollapsed ? formatTime(timeLeft) : 'Focus Timer'} {isCollapsed && isRunning ? '▶️' : ''}
        </h3>
        <button 
          className="expand-btn"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
          title="Expand to full screen"
          style={{ flexShrink: 0 }}
        >
          ⛶
        </button>
        <button 
          className="collapse-btn"
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
          title={isCollapsed ? "Expand" : "Collapse"}
          style={{ flexShrink: 0 }}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {!isCollapsed && (
      <div className="pomodoro-content">
        <div className="tree-display-wrapper">
          {/* Tree in center */}
          <div className="tree-container">
            <svg viewBox="0 0 280 320" className="tree-svg">
              {/* Ground */}
              <ellipse
                cx="140"
                cy="295"
                rx="90"
                ry="12"
                fill="#8B7355"
                opacity="0.3"
              />

              {/* Tree Trunk - grows from bottom - starts at 10% */}
              <rect
                x="115"
                y="210"
                width="50"
                height="85"
                fill="#8B4513"
                rx="8"
                className="tree-trunk"
                style={{ 
                  transform: `scaleY(${Math.min(progress / 10, 1)})`,
                  transformOrigin: 'bottom'
                }}
              />

              {/* Main foliage - appears after trunk at 15% and grows until 100% */}
              {progress > 15 && (
                <>
                  {/* Large bottom circle */}
                  <circle
                    cx="140"
                    cy="175"
                    r="70"
                    fill="#2d7a2d"
                    className="foliage foliage-1"
                    style={{ 
                      transform: `scale(${Math.min((progress - 15) / 70, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Medium left circle */}
                  <circle
                    cx="95"
                    cy="155"
                    r="50"
                    fill="#3a9f3a"
                    className="foliage foliage-2"
                    style={{ 
                      transform: `scale(${Math.min((progress - 25) / 60, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Medium right circle */}
                  <circle
                    cx="185"
                    cy="155"
                    r="50"
                    fill="#3a9f3a"
                    className="foliage foliage-3"
                    style={{ 
                      transform: `scale(${Math.min((progress - 30) / 55, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Small left-top circle */}
                  <circle
                    cx="75"
                    cy="135"
                    r="38"
                    fill="#4CAF50"
                    className="foliage foliage-5"
                    style={{ 
                      transform: `scale(${Math.min((progress - 40) / 50, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Small right-top circle */}
                  <circle
                    cx="205"
                    cy="135"
                    r="38"
                    fill="#4CAF50"
                    className="foliage foliage-6"
                    style={{ 
                      transform: `scale(${Math.min((progress - 45) / 45, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Top center circle */}
                  <circle
                    cx="140"
                    cy="115"
                    r="55"
                    fill="#66BB6A"
                    className="foliage foliage-4"
                    style={{ 
                      transform: `scale(${Math.min((progress - 50) / 40, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Extra small left circle */}
                  <circle
                    cx="55"
                    cy="170"
                    r="32"
                    fill="#2e7d32"
                    className="foliage foliage-7"
                    style={{ 
                      transform: `scale(${Math.min((progress - 60) / 35, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Extra small right circle */}
                  <circle
                    cx="225"
                    cy="170"
                    r="32"
                    fill="#2e7d32"
                    className="foliage foliage-8"
                    style={{ 
                      transform: `scale(${Math.min((progress - 65) / 30, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Top-left accent */}
                  <circle
                    cx="105"
                    cy="100"
                    r="35"
                    fill="#81C784"
                    className="foliage foliage-9"
                    style={{ 
                      transform: `scale(${Math.min((progress - 70) / 25, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Top-right accent */}
                  <circle
                    cx="175"
                    cy="100"
                    r="35"
                    fill="#81C784"
                    className="foliage foliage-10"
                    style={{ 
                      transform: `scale(${Math.min((progress - 75) / 20, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                  
                  {/* Final top flourish */}
                  <circle
                    cx="140"
                    cy="85"
                    r="40"
                    fill="#A5D6A7"
                    className="foliage foliage-11"
                    style={{ 
                      transform: `scale(${Math.min((progress - 85) / 15, 1)})`,
                      transformOrigin: 'center'
                    }}
                  />
                </>
              )}

              {/* Smiley Fruits - appear progressively - larger and more visible */}
              {fruits[0] && (
                <g className="fruit fruit-1">
                  <circle cx="95" cy="150" r="12" fill="#FF6B6B" />
                  <circle cx="92" cy="147" r="2.5" fill="#333" />
                  <circle cx="98" cy="147" r="2.5" fill="#333" />
                  <path d="M 90 152 Q 95 156 100 152" stroke="#333" strokeWidth="1.5" fill="none" />
                </g>
              )}

              {fruits[1] && (
                <g className="fruit fruit-2">
                  <circle cx="185" cy="145" r="12" fill="#FFA500" />
                  <circle cx="182" cy="142" r="2.5" fill="#333" />
                  <circle cx="188" cy="142" r="2.5" fill="#333" />
                  <path d="M 180 147 Q 185 151 190 147" stroke="#333" strokeWidth="1.5" fill="none" />
                </g>
              )}

              {fruits[2] && (
                <g className="fruit fruit-3">
                  <circle cx="115" cy="125" r="12" fill="#FFD700" />
                  <circle cx="112" cy="122" r="2.5" fill="#333" />
                  <circle cx="118" cy="122" r="2.5" fill="#333" />
                  <path d="M 110 127 Q 115 131 120 127" stroke="#333" strokeWidth="1.5" fill="none" />
                </g>
              )}

              {fruits[3] && (
                <g className="fruit fruit-4">
                  <circle cx="165" cy="120" r="12" fill="#FF69B4" />
                  <circle cx="162" cy="117" r="2.5" fill="#333" />
                  <circle cx="168" cy="117" r="2.5" fill="#333" />
                  <path d="M 160 122 Q 165 126 170 122" stroke="#333" strokeWidth="1.5" fill="none" />
                </g>
              )}

              {fruits[4] && (
                <g className="fruit fruit-5">
                  <circle cx="140" cy="175" r="12" fill="#9370DB" />
                  <circle cx="137" cy="172" r="2.5" fill="#333" />
                  <circle cx="143" cy="172" r="2.5" fill="#333" />
                  <path d="M 135 177 Q 140 181 145 177" stroke="#333" strokeWidth="1.5" fill="none" />
                </g>
              )}

              {/* Completion sparkles */}
              {isCompleted && (
                <>
                  <text x="140" y="60" fontSize="40" textAnchor="middle">✨</text>
                  <text x="60" y="130" fontSize="28" textAnchor="middle">⭐</text>
                  <text x="220" y="130" fontSize="28" textAnchor="middle">⭐</text>
                  <text x="100" y="200" fontSize="24" textAnchor="middle">🎉</text>
                  <text x="180" y="200" fontSize="24" textAnchor="middle">🎉</text>
                </>
              )}
            </svg>
          </div>
        </div>

        {/* Info below tree - smaller text */}
        <div className="tree-bottom-info">
          <div className={`time-display ${isCompleted ? 'completed' : ''}`}>
            {formatTime(timeLeft)}
          </div>
          <div className="progress-display">
            {isCompleted ? '🎉 Complete!' : `${Math.round(progress)}%`}
          </div>
        </div>

        <div className="pomodoro-controls">
          {/* Duration Selector - Dropdown */}
          <div className="duration-dropdown-wrapper">
            <select 
              id="duration-select"
              className="duration-dropdown"
              value={duration}
              onChange={(e) => handleDurationChange(Number(e.target.value))}
              disabled={isRunning}
            >
              {durationOptions.map((dur) => (
                <option key={dur} value={dur}>
                  {dur} min
                </option>
              ))}
            </select>
          </div>

          {/* Control Buttons */}
          <div className="control-buttons-row">
            {!isRunning && timeLeft === duration * 60 && (
              <button className="control-btn start-btn" onClick={handleStart}>
                ▶️ Start
              </button>
            )}
            
            {isRunning && (
              <button className="control-btn pause-btn" onClick={handlePause}>
                ⏸️ Pause
              </button>
            )}
            
            {!isRunning && timeLeft < duration * 60 && !isCompleted && (
              <button className="control-btn resume-btn" onClick={handleStart}>
                ▶️ Resume
              </button>
            )}
            
            {(timeLeft < duration * 60 || isCompleted) && (
              <button className="control-btn reset-btn" onClick={handleReset}>
                🔄 Reset
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </div>

    {/* Expanded Modal View */}
    {isExpanded && (
      <div className="pomodoro-modal-overlay" onClick={() => setIsExpanded(false)}>
        <div className="pomodoro-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="pomodoro-modal-header">
            <h2>🍅 Focus Timer</h2>
            <button 
              className="close-modal-btn"
              onClick={() => setIsExpanded(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="pomodoro-modal-body">
            <div className="tree-display-wrapper-expanded">
              {/* Large Tree */}
              <div className="tree-container-expanded">
                <svg viewBox="0 0 280 320" className="tree-svg-expanded">
                  {/* Ground */}
                  <ellipse
                    cx="140"
                    cy="295"
                    rx="90"
                    ry="12"
                    fill="#8B7355"
                    opacity="0.3"
                  />

                  {/* Tree Trunk */}
                  <rect
                    x="115"
                    y="210"
                    width="50"
                    height="85"
                    fill="#8B4513"
                    rx="8"
                    className="tree-trunk"
                    style={{ 
                      transform: `scaleY(${Math.min(progress / 10, 1)})`,
                      transformOrigin: 'bottom'
                    }}
                  />

                  {/* Main foliage */}
                  {progress > 15 && (
                    <>
                      <circle cx="140" cy="175" r="70" fill="#2d7a2d" className="foliage foliage-1"
                        style={{ transform: `scale(${Math.min((progress - 15) / 70, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="95" cy="155" r="50" fill="#3a9f3a" className="foliage foliage-2"
                        style={{ transform: `scale(${Math.min((progress - 25) / 60, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="185" cy="155" r="50" fill="#3a9f3a" className="foliage foliage-3"
                        style={{ transform: `scale(${Math.min((progress - 30) / 55, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="75" cy="135" r="38" fill="#4CAF50" className="foliage foliage-5"
                        style={{ transform: `scale(${Math.min((progress - 40) / 50, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="205" cy="135" r="38" fill="#4CAF50" className="foliage foliage-6"
                        style={{ transform: `scale(${Math.min((progress - 45) / 45, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="140" cy="115" r="55" fill="#66BB6A" className="foliage foliage-4"
                        style={{ transform: `scale(${Math.min((progress - 50) / 40, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="55" cy="170" r="32" fill="#2e7d32" className="foliage foliage-7"
                        style={{ transform: `scale(${Math.min((progress - 60) / 35, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="225" cy="170" r="32" fill="#2e7d32" className="foliage foliage-8"
                        style={{ transform: `scale(${Math.min((progress - 65) / 30, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="105" cy="100" r="35" fill="#81C784" className="foliage foliage-9"
                        style={{ transform: `scale(${Math.min((progress - 70) / 25, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="175" cy="100" r="35" fill="#81C784" className="foliage foliage-10"
                        style={{ transform: `scale(${Math.min((progress - 75) / 20, 1)})`, transformOrigin: 'center' }} />
                      <circle cx="140" cy="85" r="40" fill="#A5D6A7" className="foliage foliage-11"
                        style={{ transform: `scale(${Math.min((progress - 85) / 15, 1)})`, transformOrigin: 'center' }} />
                    </>
                  )}

                  {/* Smiley Fruits */}
                  {fruits[0] && (
                    <g className="fruit fruit-1">
                      <circle cx="95" cy="150" r="12" fill="#FF6B6B" />
                      <circle cx="92" cy="147" r="2.5" fill="#333" />
                      <circle cx="98" cy="147" r="2.5" fill="#333" />
                      <path d="M 90 152 Q 95 156 100 152" stroke="#333" strokeWidth="1.5" fill="none" />
                    </g>
                  )}
                  {fruits[1] && (
                    <g className="fruit fruit-2">
                      <circle cx="185" cy="145" r="12" fill="#FFA500" />
                      <circle cx="182" cy="142" r="2.5" fill="#333" />
                      <circle cx="188" cy="142" r="2.5" fill="#333" />
                      <path d="M 180 147 Q 185 151 190 147" stroke="#333" strokeWidth="1.5" fill="none" />
                    </g>
                  )}
                  {fruits[2] && (
                    <g className="fruit fruit-3">
                      <circle cx="115" cy="125" r="12" fill="#FFD700" />
                      <circle cx="112" cy="122" r="2.5" fill="#333" />
                      <circle cx="118" cy="122" r="2.5" fill="#333" />
                      <path d="M 110 127 Q 115 131 120 127" stroke="#333" strokeWidth="1.5" fill="none" />
                    </g>
                  )}
                  {fruits[3] && (
                    <g className="fruit fruit-4">
                      <circle cx="165" cy="120" r="12" fill="#FF69B4" />
                      <circle cx="162" cy="117" r="2.5" fill="#333" />
                      <circle cx="168" cy="117" r="2.5" fill="#333" />
                      <path d="M 160 122 Q 165 126 170 122" stroke="#333" strokeWidth="1.5" fill="none" />
                    </g>
                  )}
                  {fruits[4] && (
                    <g className="fruit fruit-5">
                      <circle cx="140" cy="175" r="12" fill="#9370DB" />
                      <circle cx="137" cy="172" r="2.5" fill="#333" />
                      <circle cx="143" cy="172" r="2.5" fill="#333" />
                      <path d="M 135 177 Q 140 181 145 177" stroke="#333" strokeWidth="1.5" fill="none" />
                    </g>
                  )}

                  {/* Completion sparkles */}
                  {isCompleted && (
                    <>
                      <text x="140" y="60" fontSize="40" textAnchor="middle">✨</text>
                      <text x="60" y="130" fontSize="28" textAnchor="middle">⭐</text>
                      <text x="220" y="130" fontSize="28" textAnchor="middle">⭐</text>
                      <text x="100" y="200" fontSize="24" textAnchor="middle">🎉</text>
                      <text x="180" y="200" fontSize="24" textAnchor="middle">🎉</text>
                    </>
                  )}
                </svg>
              </div>
            </div>

            {/* Info below tree */}
            <div className="tree-bottom-info-expanded">
              <div className={`time-display-expanded ${isCompleted ? 'completed' : ''}`}>
                {formatTime(timeLeft)}
              </div>
              <div className="progress-display-expanded">
                {isCompleted ? '🎉 Complete!' : `${Math.round(progress)}%`}
              </div>
            </div>

            {/* Controls */}
            <div className="pomodoro-controls-expanded">
              <div className="duration-dropdown-wrapper">
                <select 
                  className="duration-dropdown-expanded"
                  value={duration}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  disabled={isRunning}
                >
                  {durationOptions.map((dur) => (
                    <option key={dur} value={dur}>{dur} min</option>
                  ))}
                </select>
              </div>

              <div className="control-buttons-row-expanded">
                {!isRunning && timeLeft === duration * 60 && (
                  <button className="control-btn-expanded start-btn" onClick={handleStart}>
                    ▶️ Start
                  </button>
                )}
                {isRunning && (
                  <button className="control-btn-expanded pause-btn" onClick={handlePause}>
                    ⏸️ Pause
                  </button>
                )}
                {!isRunning && timeLeft < duration * 60 && !isCompleted && (
                  <button className="control-btn-expanded resume-btn" onClick={handleStart}>
                    ▶️ Resume
                  </button>
                )}
                {(timeLeft < duration * 60 || isCompleted) && (
                  <button className="control-btn-expanded reset-btn" onClick={handleReset}>
                    🔄 Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default PomodoroTree;
