// Theme context for MiniBox
// Defines theme colors and utilities for switching between available themes

const themes = {
  dark: {
    name: 'dark',
    label: 'Dark',
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
    queueItemCurrentBorder: 'rgba(60, 250, 255, 0.2)',
    blendMode: 'lighten'
  },
  light: {
    name: 'light',
    label: 'Light',
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
    queueItemCurrentBorder: 'rgba(255, 61, 110, 0.2)',
    blendMode: 'multiply'
  },
  nightsky: {
    name: 'nightsky',
    label: 'Night Sky',
    background: 'rgba(37, 36, 70, 0.9)',
    backgroundLight: 'rgba(37, 36, 70, 0.88)',
    backgroundRgba: 'rgba(37, 36, 70, 0.96)',
    textPrimary: '#f5f6ff',
    textSecondary: '#d3d6ff',
    textOpacity: 'rgba(245, 246, 255, 0.72)',
    textOpacityMedium: 'rgba(245, 246, 255, 0.55)',
    borderColor: 'rgba(170, 182, 255, 0.2)',
    borderColorHover: 'rgba(190, 200, 255, 0.3)',
    buttonBg: 'rgba(150, 166, 255, 0.14)',
    buttonBgHover: 'rgba(171, 186, 255, 0.22)',
    buttonBgActive: 'rgba(189, 201, 255, 0.3)',
    accentDanger: 'rgba(255, 125, 125, 0.24)',
    accentDangerBorder: 'rgba(255, 145, 145, 0.34)',
    accentDangerHover: 'rgba(255, 145, 145, 0.34)',
    bgSecondary: 'rgba(29, 28, 56, 0.96)',
    progressBg: '#3f4275',
    progressFill: '#f5f6ff',
    iconColor: '#f5f6ff',
    glitchColor1: '#7dd7ff',
    glitchColor2: '#ff94c9',
    artBg: '#222143',
    artBorder: '#40437c',
    artShadow: '#191733',
    queueItemCurrent: '#9cc9ff',
    queueItemCurrentBg: 'rgba(156, 201, 255, 0.15)',
    queueItemCurrentBorder: 'rgba(156, 201, 255, 0.32)',
    blendMode: 'lighten'
  },
  crimson: {
    name: 'crimson',
    label: 'Crimson',
    background: 'rgba(69, 3, 39, 0.9)',
    backgroundLight: 'rgba(69, 3, 39, 0.88)',
    backgroundRgba: 'rgba(69, 3, 39, 0.96)',
    textPrimary: '#ffe8f2',
    textSecondary: '#f6bfd7',
    textOpacity: 'rgba(255, 232, 242, 0.72)',
    textOpacityMedium: 'rgba(255, 232, 242, 0.54)',
    borderColor: 'rgba(255, 170, 210, 0.2)',
    borderColorHover: 'rgba(255, 189, 222, 0.32)',
    buttonBg: 'rgba(255, 140, 196, 0.15)',
    buttonBgHover: 'rgba(255, 161, 208, 0.23)',
    buttonBgActive: 'rgba(255, 182, 220, 0.3)',
    accentDanger: 'rgba(255, 120, 150, 0.25)',
    accentDangerBorder: 'rgba(255, 145, 170, 0.36)',
    accentDangerHover: 'rgba(255, 145, 170, 0.36)',
    bgSecondary: 'rgba(52, 2, 30, 0.96)',
    progressBg: '#61213f',
    progressFill: '#ffe8f2',
    iconColor: '#ffe8f2',
    glitchColor1: '#ff8cb4',
    glitchColor2: '#9be6ff',
    artBg: '#3a0724',
    artBorder: '#6d2b4b',
    artShadow: '#260418',
    queueItemCurrent: '#ffb7d4',
    queueItemCurrentBg: 'rgba(255, 183, 212, 0.17)',
    queueItemCurrentBorder: 'rgba(255, 183, 212, 0.34)',
    blendMode: 'lighten'
  },
  beachsand: {
    name: 'beachsand',
    label: 'Beach Sand',
    background: 'rgba(230, 217, 150, 0.9)',
    backgroundLight: 'rgba(230, 217, 150, 0.88)',
    backgroundRgba: 'rgba(230, 217, 150, 0.96)',
    textPrimary: '#2d250b',
    textSecondary: '#4b3f16',
    textOpacity: 'rgba(45, 37, 11, 0.72)',
    textOpacityMedium: 'rgba(45, 37, 11, 0.56)',
    borderColor: 'rgba(109, 90, 31, 0.24)',
    borderColorHover: 'rgba(109, 90, 31, 0.36)',
    buttonBg: 'rgba(109, 90, 31, 0.12)',
    buttonBgHover: 'rgba(109, 90, 31, 0.2)',
    buttonBgActive: 'rgba(109, 90, 31, 0.28)',
    accentDanger: 'rgba(176, 69, 69, 0.2)',
    accentDangerBorder: 'rgba(176, 69, 69, 0.32)',
    accentDangerHover: 'rgba(176, 69, 69, 0.32)',
    bgSecondary: 'rgba(214, 199, 128, 0.96)',
    progressBg: '#c2b36b',
    progressFill: '#2d250b',
    iconColor: '#2d250b',
    glitchColor1: '#2f7f9c',
    glitchColor2: '#a64d79',
    artBg: '#d9cb8a',
    artBorder: '#b9a95b',
    artShadow: '#c3b56f',
    queueItemCurrent: '#7a4f1c',
    queueItemCurrentBg: 'rgba(122, 79, 28, 0.13)',
    queueItemCurrentBorder: 'rgba(122, 79, 28, 0.28)',
    blendMode: 'multiply'
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    background: 'rgba(22, 38, 39, 0.9)',
    backgroundLight: 'rgba(22, 38, 39, 0.88)',
    backgroundRgba: 'rgba(22, 38, 39, 0.96)',
    textPrimary: '#e7f3ef',
    textSecondary: '#bdd6cf',
    textOpacity: 'rgba(231, 243, 239, 0.74)',
    textOpacityMedium: 'rgba(231, 243, 239, 0.56)',
    borderColor: 'rgba(152, 205, 185, 0.2)',
    borderColorHover: 'rgba(173, 220, 201, 0.3)',
    buttonBg: 'rgba(114, 174, 151, 0.14)',
    buttonBgHover: 'rgba(132, 193, 170, 0.22)',
    buttonBgActive: 'rgba(153, 210, 188, 0.3)',
    accentDanger: 'rgba(207, 96, 109, 0.24)',
    accentDangerBorder: 'rgba(225, 126, 138, 0.34)',
    accentDangerHover: 'rgba(225, 126, 138, 0.34)',
    bgSecondary: 'rgba(17, 31, 32, 0.96)',
    progressBg: '#365557',
    progressFill: '#e7f3ef',
    iconColor: '#e7f3ef',
    glitchColor1: '#70e2c0',
    glitchColor2: '#8db7ff',
    artBg: '#1b3132',
    artBorder: '#34595b',
    artShadow: '#132324',
    queueItemCurrent: '#9be8ce',
    queueItemCurrentBg: 'rgba(155, 232, 206, 0.16)',
    queueItemCurrentBorder: 'rgba(155, 232, 206, 0.32)',
    blendMode: 'lighten'
  },
  red: {
    name: 'red',
    label: 'Red',
    background: 'rgba(82, 11, 32, 0.9)',
    backgroundLight: 'rgba(82, 11, 32, 0.88)',
    backgroundRgba: 'rgba(82, 11, 32, 0.96)',
    textPrimary: '#ffe9ee',
    textSecondary: '#f2c1ce',
    textOpacity: 'rgba(255, 233, 238, 0.72)',
    textOpacityMedium: 'rgba(255, 233, 238, 0.54)',
    borderColor: 'rgba(255, 166, 185, 0.22)',
    borderColorHover: 'rgba(255, 184, 201, 0.34)',
    buttonBg: 'rgba(255, 132, 160, 0.15)',
    buttonBgHover: 'rgba(255, 153, 178, 0.24)',
    buttonBgActive: 'rgba(255, 176, 196, 0.31)',
    accentDanger: 'rgba(255, 112, 112, 0.25)',
    accentDangerBorder: 'rgba(255, 138, 138, 0.36)',
    accentDangerHover: 'rgba(255, 138, 138, 0.36)',
    bgSecondary: 'rgba(62, 9, 25, 0.96)',
    progressBg: '#6f2840',
    progressFill: '#ffe9ee',
    iconColor: '#ffe9ee',
    glitchColor1: '#ff809d',
    glitchColor2: '#8fd6ff',
    artBg: '#460d22',
    artBorder: '#7f2f4b',
    artShadow: '#300717',
    queueItemCurrent: '#ffb5c8',
    queueItemCurrentBg: 'rgba(255, 181, 200, 0.17)',
    queueItemCurrentBorder: 'rgba(255, 181, 200, 0.34)',
    blendMode: 'lighten'
  },
  grape: {
    name: 'grape',
    label: 'Grape',
    background: 'rgba(21, 2, 30, 0.9)',
    backgroundLight: 'rgba(21, 2, 30, 0.88)',
    backgroundRgba: 'rgba(21, 2, 30, 0.96)',
    textPrimary: '#f7edff',
    textSecondary: '#dfc8f2',
    textOpacity: 'rgba(247, 237, 255, 0.74)',
    textOpacityMedium: 'rgba(247, 237, 255, 0.56)',
    borderColor: 'rgba(201, 158, 235, 0.22)',
    borderColorHover: 'rgba(220, 182, 247, 0.34)',
    buttonBg: 'rgba(179, 126, 223, 0.15)',
    buttonBgHover: 'rgba(195, 145, 234, 0.24)',
    buttonBgActive: 'rgba(211, 167, 244, 0.31)',
    accentDanger: 'rgba(255, 116, 148, 0.24)',
    accentDangerBorder: 'rgba(255, 144, 171, 0.35)',
    accentDangerHover: 'rgba(255, 144, 171, 0.35)',
    bgSecondary: 'rgba(15, 2, 23, 0.96)',
    progressBg: '#3a2250',
    progressFill: '#f7edff',
    iconColor: '#f7edff',
    glitchColor1: '#b993ff',
    glitchColor2: '#ff86c0',
    artBg: '#1f0730',
    artBorder: '#4a2967',
    artShadow: '#13041f',
    queueItemCurrent: '#dbb5ff',
    queueItemCurrentBg: 'rgba(219, 181, 255, 0.17)',
    queueItemCurrentBorder: 'rgba(219, 181, 255, 0.34)',
    blendMode: 'lighten'
  },
  lime: {
    name: 'lime',
    label: 'Lime',
    background: 'rgba(29, 64, 16, 0.9)',
    backgroundLight: 'rgba(29, 64, 16, 0.88)',
    backgroundRgba: 'rgba(29, 64, 16, 0.96)',
    textPrimary: '#f0ffe9',
    textSecondary: '#cfeebf',
    textOpacity: 'rgba(240, 255, 233, 0.74)',
    textOpacityMedium: 'rgba(240, 255, 233, 0.56)',
    borderColor: 'rgba(181, 232, 145, 0.22)',
    borderColorHover: 'rgba(199, 243, 168, 0.34)',
    buttonBg: 'rgba(156, 222, 109, 0.15)',
    buttonBgHover: 'rgba(173, 233, 128, 0.24)',
    buttonBgActive: 'rgba(191, 241, 149, 0.31)',
    accentDanger: 'rgba(255, 129, 129, 0.24)',
    accentDangerBorder: 'rgba(255, 156, 156, 0.35)',
    accentDangerHover: 'rgba(255, 156, 156, 0.35)',
    bgSecondary: 'rgba(22, 50, 13, 0.96)',
    progressBg: '#355f2a',
    progressFill: '#f0ffe9',
    iconColor: '#f0ffe9',
    glitchColor1: '#b7ff8f',
    glitchColor2: '#8fe8ff',
    artBg: '#254f16',
    artBorder: '#4d7a33',
    artShadow: '#19340f',
    queueItemCurrent: '#d3ffad',
    queueItemCurrentBg: 'rgba(211, 255, 173, 0.17)',
    queueItemCurrentBorder: 'rgba(211, 255, 173, 0.34)',
    blendMode: 'lighten'
  },
  periwinkle: {
    name: 'periwinkle',
    label: 'Periwinkle',
    background: 'rgba(104, 111, 208, 0.9)',
    backgroundLight: 'rgba(104, 111, 208, 0.88)',
    backgroundRgba: 'rgba(104, 111, 208, 0.96)',
    textPrimary: '#f3f4ff',
    textSecondary: '#d9dcff',
    textOpacity: 'rgba(243, 244, 255, 0.74)',
    textOpacityMedium: 'rgba(243, 244, 255, 0.56)',
    borderColor: 'rgba(205, 210, 255, 0.22)',
    borderColorHover: 'rgba(220, 224, 255, 0.34)',
    buttonBg: 'rgba(196, 202, 255, 0.18)',
    buttonBgHover: 'rgba(210, 215, 255, 0.28)',
    buttonBgActive: 'rgba(224, 228, 255, 0.36)',
    accentDanger: 'rgba(255, 126, 153, 0.24)',
    accentDangerBorder: 'rgba(255, 152, 176, 0.35)',
    accentDangerHover: 'rgba(255, 152, 176, 0.35)',
    bgSecondary: 'rgba(87, 93, 182, 0.96)',
    progressBg: '#545cb0',
    progressFill: '#f3f4ff',
    iconColor: '#f3f4ff',
    glitchColor1: '#9ad7ff',
    glitchColor2: '#ffc2e7',
    artBg: '#5f66bd',
    artBorder: '#858ce0',
    artShadow: '#4c529c',
    queueItemCurrent: '#d6ddff',
    queueItemCurrentBg: 'rgba(214, 221, 255, 0.2)',
    queueItemCurrentBorder: 'rgba(214, 221, 255, 0.36)',
    blendMode: 'lighten'
  },
  mint: {
    name: 'mint',
    label: 'Mint',
    background: 'rgba(145, 222, 158, 0.9)',
    backgroundLight: 'rgba(145, 222, 158, 0.88)',
    backgroundRgba: 'rgba(145, 222, 158, 0.96)',
    textPrimary: '#112819',
    textSecondary: '#1f3d2a',
    textOpacity: 'rgba(17, 40, 25, 0.72)',
    textOpacityMedium: 'rgba(17, 40, 25, 0.56)',
    borderColor: 'rgba(33, 94, 49, 0.24)',
    borderColorHover: 'rgba(33, 94, 49, 0.36)',
    buttonBg: 'rgba(33, 94, 49, 0.14)',
    buttonBgHover: 'rgba(33, 94, 49, 0.22)',
    buttonBgActive: 'rgba(33, 94, 49, 0.3)',
    accentDanger: 'rgba(186, 70, 98, 0.2)',
    accentDangerBorder: 'rgba(186, 70, 98, 0.32)',
    accentDangerHover: 'rgba(186, 70, 98, 0.32)',
    bgSecondary: 'rgba(126, 204, 140, 0.96)',
    progressBg: '#6fbc7d',
    progressFill: '#112819',
    iconColor: '#112819',
    glitchColor1: '#2e8ca0',
    glitchColor2: '#8f3f7f',
    artBg: '#86d595',
    artBorder: '#5bab6b',
    artShadow: '#74c184',
    queueItemCurrent: '#1d5f33',
    queueItemCurrentBg: 'rgba(29, 95, 51, 0.14)',
    queueItemCurrentBorder: 'rgba(29, 95, 51, 0.28)',
    blendMode: 'multiply'
  },
  mocha: {
    name: 'mocha',
    label: 'Mocha',
    background: 'rgba(61, 41, 31, 0.9)',
    backgroundLight: 'rgba(61, 41, 31, 0.88)',
    backgroundRgba: 'rgba(61, 41, 31, 0.96)',
    textPrimary: '#f7efe9',
    textSecondary: '#e6d3c7',
    textOpacity: 'rgba(247, 239, 233, 0.74)',
    textOpacityMedium: 'rgba(247, 239, 233, 0.56)',
    borderColor: 'rgba(216, 181, 157, 0.22)',
    borderColorHover: 'rgba(229, 198, 177, 0.34)',
    buttonBg: 'rgba(197, 153, 125, 0.15)',
    buttonBgHover: 'rgba(212, 170, 144, 0.24)',
    buttonBgActive: 'rgba(226, 189, 166, 0.31)',
    accentDanger: 'rgba(255, 130, 130, 0.24)',
    accentDangerBorder: 'rgba(255, 158, 158, 0.35)',
    accentDangerHover: 'rgba(255, 158, 158, 0.35)',
    bgSecondary: 'rgba(48, 32, 24, 0.96)',
    progressBg: '#6a4d3e',
    progressFill: '#f7efe9',
    iconColor: '#f7efe9',
    glitchColor1: '#ffc39a',
    glitchColor2: '#9edbff',
    artBg: '#4b3327',
    artBorder: '#7f5b47',
    artShadow: '#332218',
    queueItemCurrent: '#ffd4b9',
    queueItemCurrentBg: 'rgba(255, 212, 185, 0.17)',
    queueItemCurrentBorder: 'rgba(255, 212, 185, 0.34)',
    blendMode: 'lighten'
  }
};

let themeTransitionTimeout = null;

function triggerThemeTransition(root) {
  if (!root) {
    return;
  }

  root.classList.add('theme-transitioning');
  if (themeTransitionTimeout) {
    clearTimeout(themeTransitionTimeout);
  }

  themeTransitionTimeout = setTimeout(() => {
    root.classList.remove('theme-transitioning');
    themeTransitionTimeout = null;
  }, 280);
}

// Apply theme by setting CSS custom properties
function applyTheme(themeName) {
  const theme = themes[themeName] || themes.dark;
  const root = document.documentElement;

  triggerThemeTransition(root);
  
  // Set theme data attribute for CSS selectors
  root.setAttribute('data-theme', themeName);
  
  // Set blend mode based on theme
  const blendMode = theme.blendMode || (themeName === 'light' ? 'multiply' : 'lighten');
  root.style.setProperty('--theme-blend-mode', blendMode);
  
  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name' && key !== 'label' && key !== 'blendMode') {
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
        .filter(([key]) => key !== 'name' && key !== 'label' && key !== 'blendMode')
        .map(([key, value]) => `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`)
        .join('\n      ')}
    }

    @media (prefers-reduced-motion: no-preference) {
      .theme-transitioning,
      .theme-transitioning *,
      .theme-transitioning *::before,
      .theme-transitioning *::after {
        transition:
          background-color 220ms ease,
          color 220ms ease,
          border-color 220ms ease,
          box-shadow 220ms ease,
          fill 220ms ease,
          stroke 220ms ease;
      }
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

if (typeof window !== 'undefined') {
  window.availableThemes = themes;
}
