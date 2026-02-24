'use client';

import React, { useState } from 'react';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presetColors?: string[];
}

const DEFAULT_PRESETS = [
  '#25D366', '#128C7E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#F59E0B', '#EF4444', '#1A1A1A',
];

export default function ColorPicker({
  value,
  onChange,
  label,
  presetColors = DEFAULT_PRESETS,
}: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);

  const handleColorChange = (color: string) => {
    onChange(color);
    setHexInput(color);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleHexBlur = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(value);
    }
  };

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.pickerRow}>
        <div className={styles.colorInputWrapper} title="Pick a color">
          <input
            type="color"
            className={styles.colorInput}
            value={value}
            onChange={(e) => handleColorChange(e.target.value)}
            aria-label={label ?? 'Color picker'}
          />
        </div>
        <input
          type="text"
          className={styles.hexInput}
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          placeholder="#000000"
          maxLength={7}
          aria-label="Hex color value"
        />
      </div>
      {presetColors.length > 0 && (
        <div className={styles.presets} role="group" aria-label="Preset colors">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              className={[styles.preset, color === value ? styles.selected : ''].filter(Boolean).join(' ')}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
              aria-label={`Select color ${color}`}
              aria-pressed={color === value}
            />
          ))}
        </div>
      )}
    </div>
  );
}
