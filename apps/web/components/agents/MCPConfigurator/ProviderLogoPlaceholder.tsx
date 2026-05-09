'use client';

import React from 'react';

interface ProviderLogoPlaceholderProps {
  id: string;
  name: string;
  logoUrl?: string;
  size?: number;
}

/**
 * Renders the first 2 letters of `name` on a hash-derived background color.
 * Falls back to <img> when `logoUrl` is provided. Mirrors the agent avatar
 * pattern: deterministic color per id so the same provider always looks the
 * same.
 */
function hashToHsl(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const first = parts[0]!;
    return first.slice(0, 2).toUpperCase();
  }
  return ((parts[0]![0] ?? '') + (parts[1]![0] ?? '')).toUpperCase();
}

export default function ProviderLogoPlaceholder({
  id,
  name,
  logoUrl,
  size = 48,
}: ProviderLogoPlaceholderProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--color-bg-sidebar)',
        }}
      />
    );
  }

  const bg = hashToHsl(id);
  const initials = initialsFromName(name);
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.5px',
        flexShrink: 0,
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
