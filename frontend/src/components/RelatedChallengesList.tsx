/**
 * RelatedChallengesList Component
 * Reusable component to display challenges with context badges
 * Shows where challenges are linked from (goal/project) and handles de-duplication
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Challenge {
  id: number;
  name: string;
  description: string | null;
  challenge_type: string;
  start_date: string;
  end_date: string;
  status: string;
  linked_to: 'goal' | 'project';
  project_id?: number;
  project_name?: string;
  goal_id?: number;
  goal_name?: string;
}

interface RelatedChallengesListProps {
  directChallenges: Challenge[];
  relatedChallenges?: Challenge[];
  title: string;
  emptyMessage?: string;
}

export const RelatedChallengesList: React.FC<RelatedChallengesListProps> = ({
  directChallenges,
  relatedChallenges = [],
  title,
  emptyMessage = "No challenges found"
}) => {
  const navigate = useNavigate();

  const getChallengeTypeIcon = (type: string): string => {
    switch (type) {
      case 'daily_streak': return '🔥';
      case 'count_based': return '🎯';
      case 'accumulation': return '📈';
      default: return '✨';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'failed': return '#f44336';
      case 'abandoned': return '#9e9e9e';
      default: return '#ff9800';
    }
  };

  const handleChallengeClick = (challengeId: number) => {
    // Navigate to challenges page with this challenge highlighted
    navigate(`/challenges?highlight=${challengeId}`);
  };

  if (directChallenges.length === 0 && relatedChallenges.length === 0) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#666'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ marginBottom: '16px', color: '#333' }}>{title}</h3>

      {/* Direct Challenges */}
      {directChallenges.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Direct Challenges
          </h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            {directChallenges.map((challenge) => (
              <div
                key={challenge.id}
                onClick={() => handleChallengeClick(challenge.id)}
                style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{getChallengeTypeIcon(challenge.challenge_type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                      {challenge.name}
                    </div>
                    {challenge.description && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                        {challenge.description}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: getStatusColor(challenge.status),
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}
                  >
                    {challenge.status}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  📅 {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Challenges (from projects or goals) */}
      {relatedChallenges.length > 0 && (
        <div>
          <h4 style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {relatedChallenges[0].linked_to === 'project' ? 'Via Projects' : 'Via Parent Goal'}
          </h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            {relatedChallenges.map((challenge) => (
              <div
                key={challenge.id}
                onClick={() => handleChallengeClick(challenge.id)}
                style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '2px solid #e0e0e0',
                  borderLeft: `4px solid ${challenge.linked_to === 'project' ? '#ff9800' : '#2196f3'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{getChallengeTypeIcon(challenge.challenge_type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                      {challenge.name}
                    </div>
                    {challenge.description && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                        {challenge.description}
                      </div>
                    )}
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#999', 
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {challenge.linked_to === 'project' && (
                        <>
                          📦 <strong>{challenge.project_name}</strong>
                        </>
                      )}
                      {challenge.linked_to === 'goal' && (
                        <>
                          🎯 <strong>{challenge.goal_name}</strong>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: getStatusColor(challenge.status),
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}
                  >
                    {challenge.status}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  📅 {new Date(challenge.start_date).toLocaleDateString()} - {new Date(challenge.end_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
