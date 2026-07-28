import React from 'react';
import { UserTitle } from '../types';

export const FLAG_GRADIENTS: Record<string, string> = {
  '🇷🇺': 'linear-gradient(180deg, #FFFFFF 33%, #0039A6 33%, #0039A6 66%, #D52B1E 66%)',
  '🇺🇸': 'linear-gradient(180deg, #B22234 50%, #FFFFFF 50%)', // Simplified
  '🇺🇦': 'linear-gradient(180deg, #0057B7 50%, #FFDD00 50%)',
  '🇩🇪': 'linear-gradient(180deg, #000000 33%, #DD0000 33%, #DD0000 66%, #FFCE00 66%)',
  '🇫🇷': 'linear-gradient(90deg, #002395 33%, #FFFFFF 33%, #FFFFFF 66%, #ED2939 66%)',
  '🇬🇧': 'linear-gradient(45deg, #012169 0%, #C8102E 100%)',
  '🇧🇾': 'linear-gradient(180deg, #D52B1E 66%, #009739 66%)',
  '🇰🇿': 'linear-gradient(180deg, #00AFCA 100%, #00AFCA 100%)', // simplified
  '🇯🇵': 'linear-gradient(90deg, #FFFFFF 40%, #BC002D 40%, #BC002D 60%, #FFFFFF 60%)'
};

export const AVAILABLE_FONTS = [
  { value: 'Inter, sans-serif', label: 'Стандартный' },
  { value: '"Playfair Display", serif', label: 'Элегантный' },
  { value: '"Space Grotesk", sans-serif', label: 'Футуристичный' },
  { value: '"JetBrains Mono", monospace', label: 'Моноширинный' },
  { value: '"Comic Neue", cursive', label: 'Шутливый' },
  { value: '"Anton", sans-serif', label: 'Массивный' }
];

interface RenderTitleProps {
  title: UserTitle;
  className?: string;
}

export const RenderTitle: React.FC<RenderTitleProps> = ({ title, className = '' }) => {
  const style: React.CSSProperties = {
    fontFamily: title.font || 'Inter, sans-serif',
    fontWeight: title.isBold ? 'bold' : (title.font?.includes('Anton') ? 'normal' : '600'),
    fontStyle: title.isItalic ? 'italic' : 'normal',
    textDecoration: title.isUnderline ? 'underline' : 'none',
    backgroundColor: title.background || 'rgba(255, 255, 255, 0.5)',
    borderColor: title.border || 'rgba(0, 0, 0, 0.1)',
    boxShadow: title.glowColor ? `0 0 8px ${title.glowColor}` : 'none',
  };

  const animations: Record<string, string> = {
    pulse: 'title-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    rainbow: 'title-rainbow 3s linear infinite',
    shimmer: 'title-shimmer 2s linear infinite',
    bounce: 'title-bounce 2s infinite',
  };

  if (title.animation && title.animation !== 'none') {
    style.animation = animations[title.animation];
  }

  if (title.flagId && FLAG_GRADIENTS[title.flagId]) {
    style.backgroundImage = FLAG_GRADIENTS[title.flagId];
    style.WebkitBackgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.backgroundClip = 'text';
    style.color = 'transparent';
    // When using text-clip background, we need to be careful with text-shadow
    if (!title.glowColor) {
      style.textShadow = '0px 1px 1px rgba(0,0,0,0.1)';
    }
  } else if (title.animation === 'rainbow') {
    style.backgroundImage = 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)';
    style.WebkitBackgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.backgroundClip = 'text';
  } else {
    style.color = title.color || '#3b82f6';
  }

  return (
    <span 
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-widest border transition-all duration-300 ${className}`} 
      style={style}
      title={title.text}
    >
      {title.text}
    </span>
  );
};
