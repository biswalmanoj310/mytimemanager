import React from 'react';
import '../styles/RowReorder.css';

interface Props {
  visible: boolean;
  onReset: () => void;
  defaultLabel?: string;
}

/** Shown only while a custom drag order is active. */
const RowOrderResetButton: React.FC<Props> = ({ visible, onReset, defaultLabel = 'Pillar → Category' }) => {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="row-order-reset"
      onClick={onReset}
      title="Drag rows to prioritise. Click to go back to the default order."
    >
      ↺ Back to default order ({defaultLabel})
    </button>
  );
};

export default RowOrderResetButton;
