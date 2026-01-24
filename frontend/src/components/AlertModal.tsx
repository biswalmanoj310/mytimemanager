import React from 'react';
import './AlertModal.css';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export const AlertModal: React.FC<AlertModalProps> = ({ 
  isOpen, 
  message, 
  onClose, 
  type = 'success' 
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '✅';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#10b981';
    }
  };

  return (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-header" style={{ color: getColor() }}>
          <span style={{ fontSize: '48px' }}>{getIcon()}</span>
        </div>
        <div className="alert-modal-body">
          <p>{message}</p>
        </div>
        <div className="alert-modal-footer">
          <button 
            className="alert-modal-button" 
            onClick={onClose}
            style={{ backgroundColor: getColor() }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
