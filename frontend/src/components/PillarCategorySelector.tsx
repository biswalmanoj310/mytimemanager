/**
 * Reusable Pillar/Category/SubCategory Selector Component
 * 
 * Based on the Three-Pillar Philosophy:
 * - Hard Work (Career, Learning, Health)
 * - Calmness (Mindfulness, Peace, Balance)
 * - Family (Relationships, Community, Love)
 * 
 * Use this component in:
 * - Habits (for organization and streak tracking)
 * - Goals (for life alignment - Covey's "First Things First")
 * - Challenges (for focused growth areas)
 * - Tasks (for GTD-style context management)
 * - Dreams/Wishes (for life vision clarity)
 * 
 * Research-backed benefits:
 * - Consistent categorization improves focus (Deep Work - Cal Newport)
 * - Identity-based organization strengthens commitment (Atomic Habits - James Clear)
 * - Values alignment increases motivation (Start With Why - Simon Sinek)
 */

import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Pillar {
  id: number;
  name: string;
  description?: string;
}

interface Category {
  id: number;
  name: string;
  pillar_id: number;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

interface PillarCategorySelectorProps {
  // Selected values (controlled component)
  selectedPillarId?: number | null;
  selectedCategoryId?: number | null;
  selectedSubCategoryId?: number | null;
  
  // Callbacks
  onPillarChange?: (pillarId: number | null) => void;
  onCategoryChange?: (categoryId: number | null) => void;
  onSubCategoryChange?: (subCategoryId: number | null) => void;
  
  // Configuration
  showSubCategory?: boolean; // Default true
  required?: boolean; // Make pillar/category required
  disabled?: boolean;
  
  // Styling
  layout?: 'vertical' | 'horizontal'; // Default vertical
  labelStyle?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
}

export const PillarCategorySelector: React.FC<PillarCategorySelectorProps> = ({
  selectedPillarId,
  selectedCategoryId,
  selectedSubCategoryId,
  onPillarChange,
  onCategoryChange,
  onSubCategoryChange,
  showSubCategory = false,  // Changed to false - most forms don't need subcategory
  required = false,
  disabled = false,
  layout = 'vertical',
  labelStyle = {},
  selectStyle = {}
}) => {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Filter categories when pillar changes
  useEffect(() => {
    if (selectedPillarId && Array.isArray(categories)) {
      setFilteredCategories(categories.filter(c => c.pillar_id === selectedPillarId));
    } else {
      setFilteredCategories([]);
    }
  }, [selectedPillarId, categories]);

  // Filter subcategories when category changes
  useEffect(() => {
    if (selectedCategoryId && Array.isArray(subCategories)) {
      setFilteredSubCategories(subCategories.filter(sc => sc.category_id === selectedCategoryId));
    } else {
      setFilteredSubCategories([]);
    }
  }, [selectedCategoryId, subCategories]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading pillar/category data...');
      const [pillarsData, categoriesData, subCategoriesData] = await Promise.all([
        api.get('/api/pillars/'),
        api.get('/api/categories/'),
        api.get('/api/sub-categories/')
      ]);
      
      console.log('✅ Pillars loaded:', pillarsData);
      console.log('✅ Categories loaded:', categoriesData);
      console.log('✅ SubCategories loaded:', subCategoriesData);
      
      setPillars(Array.isArray(pillarsData) ? pillarsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSubCategories(Array.isArray(subCategoriesData) ? subCategoriesData : []);
    } catch (err: any) {
      console.error('❌ Error loading pillar/category data:', err);
      setError('Failed to load organization data');
      setPillars([]);
      setCategories([]);
      setSubCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePillarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onPillarChange?.(value);
    // Reset dependent selections
    onCategoryChange?.(null);
    onSubCategoryChange?.(null);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onCategoryChange?.(value);
    // Reset dependent selection
    onSubCategoryChange?.(null);
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onSubCategoryChange?.(value);
  };

  const defaultLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    ...labelStyle
  };

  const defaultSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: disabled ? '#f5f5f5' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...selectStyle
  };

  const containerStyle: React.CSSProperties = layout === 'horizontal' 
    ? { display: 'flex', gap: '15px', alignItems: 'flex-start' }
    : { display: 'flex', flexDirection: 'column', gap: '12px' };

  const fieldStyle: React.CSSProperties = layout === 'horizontal'
    ? { flex: 1 }
    : {};

  if (loading) {
    return <div style={{ padding: '10px', color: '#666' }}>Loading pillars and categories...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '10px', color: '#e53e3e', fontSize: '14px' }}>
        {error}
        <button 
          onClick={loadAllData} 
          style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '12px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Pillar Selection */}
      <div style={fieldStyle}>
        <label style={defaultLabelStyle}>
          Pillar {required && <span style={{ color: '#e53e3e' }}>*</span>}
        </label>
        <select
          value={selectedPillarId || ''}
          onChange={handlePillarChange}
          disabled={disabled}
          required={required}
          style={defaultSelectStyle}
        >
          <option value="">-- Select Pillar --</option>
          {pillars.map(pillar => (
            <option key={pillar.id} value={pillar.id}>
              {pillar.name}
            </option>
          ))}
        </select>
      </div>

      {/* Category Selection */}
      <div style={fieldStyle}>
        <label style={defaultLabelStyle}>
          Category {required && <span style={{ color: '#e53e3e' }}>*</span>}
        </label>
        <select
          value={selectedCategoryId || ''}
          onChange={handleCategoryChange}
          disabled={disabled || !selectedPillarId}
          required={required}
          style={defaultSelectStyle}
        >
          <option value="">-- Select Category --</option>
          {filteredCategories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* SubCategory Selection (Optional) */}
      {showSubCategory && (
        <div style={fieldStyle}>
          <label style={defaultLabelStyle}>
            Sub-Category <span style={{ fontSize: '12px', color: '#999' }}>(Optional)</span>
          </label>
          <select
            value={selectedSubCategoryId || ''}
            onChange={handleSubCategoryChange}
            disabled={disabled || !selectedCategoryId}
            style={defaultSelectStyle}
          >
            <option value="">-- Select Sub-Category --</option>
            {filteredSubCategories.map(subCategory => (
              <option key={subCategory.id} value={subCategory.id}>
                {subCategory.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
