// Theme context for MiniBox
// Defines theme colors and utilities for switching between dark and light themes

const themes = {
  dark: {
    name: 'dark',
    background: 'rgba(12, 12, 12, 0.85)',
    backgroundLight: 'rgba(12, 12, 12, 0.85)',
    backgroundRgba: 'rgba(12, 12, 12, 0.95)',
    textPrimary: '#fff',
    textSecondary: '#ccc',
    textOpacity: 'rgba(255, 255, 255, 0.7)',
    textOpacityMedium: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderColorHover: 'rgba(255, 255, 255, 0.15)',
    buttonBg: 'rgba(255, 255, 255, 0.05)',
    buttonBgHover: 'rgba(255, 255, 255, 0.1)',
    buttonBgActive: 'rgba(255, 255, 255, 0.15)',
    accentDanger: 'rgba(255, 100, 100, 0.2)',
    accentDangerBorder: 'rgba(255, 100, 100, 0.3)',
    accentDangerHover: 'rgba(255, 100, 100, 0.3)',
    bgSecondary: 'rgba(20, 20, 20, 0.95)',
    progressBg: '#3a3a3a',
    progressFill: '#fff',
    iconColor: '#fff',
    glitchColor1: '#3cfaff',
    glitchColor2: '#ff3d6e',
    artBg: '#0e0e0e',
    artBorder: '#262626',
    artShadow: '#141414',
    queueItemCurrent: '#3cfaff',
    queueItemCurrentBg: 'rgba(60, 250, 255, 0.1)',
    queueItemCurrentBorder: 'rgba(60, 250, 255, 0.2)'
  },
  light: {
    name: 'light',
    background: 'rgba(255, 255, 255, 0.85)',
    backgroundLight: 'rgba(255, 255, 255, 0.85)',
    backgroundRgba: 'rgba(255, 255, 255, 0.95)',
    textPrimary: '#000',
    textSecondary: '#333',
    textOpacity: 'rgba(0, 0, 0, 0.7)',
    textOpacityMedium: 'rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderColorHover: 'rgba(0, 0, 0, 0.15)',
    buttonBg: 'rgba(0, 0, 0, 0.05)',
    buttonBgHover: 'rgba(0, 0, 0, 0.1)',
    buttonBgActive: 'rgba(0, 0, 0, 0.15)',
    accentDanger: 'rgba(255, 100, 100, 0.3)',
    accentDangerBorder: 'rgba(255, 100, 100, 0.4)',
    accentDangerHover: 'rgba(255, 100, 100, 0.4)',
    bgSecondary: 'rgba(230, 230, 230, 0.95)',
    progressBg: '#d0d0d0',
    progressFill: '#000',
    iconColor: '#000',
    glitchColor1: '#4a90e2',
    glitchColor2: '#d946ef',
    artBg: '#f5f5f5',
    artBorder: '#d0d0d0',
    artShadow: '#e0e0e0',
    queueItemCurrent: '#ff3d6e',
    queueItemCurrentBg: 'rgba(255, 61, 110, 0.1)',
    queueItemCurrentBorder: 'rgba(255, 61, 110, 0.2)'
  }
};

// Apply theme by setting CSS custom properties
function applyTheme(themeName) {
  const theme = themes[themeName] || themes.dark;
  const root = document.documentElement;
  
  // Set theme data attribute for CSS selectors
  root.setAttribute('data-theme', themeName);
  
  // Set blend mode based on theme
  const blendMode = themeName === 'dark' ? 'lighten' : 'multiply';
  root.style.setProperty('--theme-blend-mode', blendMode);
  
  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name') {
      root.style.setProperty(`--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    }
  });
}

// Initialize CSS custom properties in stylesheet
function initThemeVariables() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      ${Object.entries(themes.dark)
        .filter(([key]) => key !== 'name')
        .map(([key, value]) => `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join('\n      ')}
    }
  `;
  document.head.appendChild(style);
}

// Setup theme listener from main process
function setupThemeListener(callback) {
  if (window.api && window.api.onThemeChanged) {
    window.api.onThemeChanged((event, theme) => {
      applyTheme(theme);
      if (callback) callback(theme);
    });
  }
}

// Load initial theme
async function loadInitialTheme() {
  if (window.api && window.api.getTheme) {
    try {
      const theme = await window.api.getTheme();
      applyTheme(theme);
      return theme;
    } catch (err) {
      console.error('Failed to load theme:', err);
      applyTheme('dark');
      return 'dark';
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    themes,
    applyTheme,
    initThemeVariables,
    setupThemeListener,
    loadInitialTheme
  };
}
