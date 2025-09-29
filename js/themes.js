// Theme Manager
class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.themes = {
      light: {
        name: 'Light',
        icon: '☀️'
      },
      dark: {
        name: 'Dark',
        icon: '🌙'
      },
      blue: {
        name: 'Blue',
        icon: '💙'
      },
      green: {
        name: 'Green',
        icon: '💚'
      },
      purple: {
        name: 'Purple',
        icon: '💜'
      }
    };

    this.init();
  }

  async init() {
    // Load saved theme or detect system preference
    await this.loadTheme();
    
    // Listen for system theme changes
    this.setupSystemThemeListener();
    
    // Setup theme button
    this.setupThemeButton();
  }

  async loadTheme() {
    try {
      // Try to get saved theme from storage
      const savedTheme = localStorage.getItem('todo-theme');
      
      if (savedTheme && this.themes[savedTheme]) {
        this.setTheme(savedTheme);
      } else {
        // Detect system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
      }
    } catch (error) {
      console.warn('Failed to load theme preference:', error);
      this.setTheme('light');
    }
  }

  setTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn('Unknown theme:', themeName);
      return;
    }

    // Remove current theme class
    document.body.classList.remove(...Object.keys(this.themes).map(t => `theme-${t}`));
    
    // Add new theme class
    document.body.classList.add(`theme-${themeName}`);
    
    // Update current theme
    this.currentTheme = themeName;
    
    // Save to storage
    try {
      localStorage.setItem('todo-theme', themeName);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }

    // Update theme button
    this.updateThemeButton();
    
    // Update meta theme color for mobile
    this.updateMetaThemeColor(themeName);
    
    // Dispatch theme change event
    document.dispatchEvent(new CustomEvent('themeChange', {
      detail: { theme: themeName, themeData: this.themes[themeName] }
    }));

    // Show notification
    if (window.todoApp && window.todoApp.notifications) {
      window.todoApp.notifications.showThemeChanged(this.themes[themeName].name);
    }
  }

  toggle() {
    // Simple toggle between light and dark
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  cycleThemes() {
    const themeNames = Object.keys(this.themes);
    const currentIndex = themeNames.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    this.setTheme(themeNames[nextIndex]);
  }

  setupThemeButton() {
    const themeBtn = document.getElementById('themeBtn');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
      this.showThemeSelector();
    });

    this.updateThemeButton();
  }

  updateThemeButton() {
    const themeBtn = document.getElementById('themeBtn');
    if (!themeBtn) return;

    const currentThemeData = this.themes[this.currentTheme];
    themeBtn.textContent = currentThemeData.icon;
    themeBtn.title = `Current theme: ${currentThemeData.name}`;
  }

  showThemeSelector() {
    // Create theme selector modal
    const modal = this.createThemeSelector();
    document.body.appendChild(modal);
    
    // Show with animation
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
  }

  createThemeSelector() {
    const modal = document.createElement('div');
    modal.className = 'theme-selector-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1500;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--bg-primary);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      padding: 2rem;
      max-width: 400px;
      width: 90%;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    `;

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0;">Choose Theme</h3>
        <button class="theme-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
      </div>
      <div class="theme-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
        ${Object.entries(this.themes).map(([key, theme]) => `
          <button class="theme-option ${key === this.currentTheme ? 'active' : ''}" 
                  data-theme="${key}"
                  style="
                    padding: 1rem;
                    border: 2px solid ${key === this.currentTheme ? 'var(--primary-color)' : 'var(--border-color)'};
                    border-radius: var(--border-radius);
                    background: var(--bg-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                  ">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${theme.icon}</div>
            <div style="font-size: 0.9rem; font-weight: 500;">${theme.name}</div>
          </button>
        `).join('')}
      </div>
      <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="autoThemeToggle" ${this.getAutoThemeEnabled() ? 'checked' : ''}>
          <span>Follow system theme</span>
        </label>
      </div>
    `;

    // Add event listeners
    content.addEventListener('click', (e) => {
      if (e.target.classList.contains('theme-close')) {
        this.closeThemeSelector(modal);
      } else if (e.target.closest('.theme-option')) {
        const theme = e.target.closest('.theme-option').dataset.theme;
        this.setTheme(theme);
        this.closeThemeSelector(modal);
      } else if (e.target.id === 'autoThemeToggle') {
        this.toggleAutoTheme(e.target.checked);
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeThemeSelector(modal);
      }
    });

    modal.appendChild(content);

    // Trigger animation
    modal.addEventListener('transitionend', () => {
      if (modal.classList.contains('active')) {
        content.style.transform = 'scale(1)';
      }
    });

    return modal;
  }

  closeThemeSelector(modal) {
    modal.style.opacity = '0';
    modal.querySelector('div').style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  setupSystemThemeListener() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (this.getAutoThemeEnabled()) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      // Older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  getAutoThemeEnabled() {
    try {
      return localStorage.getItem('todo-auto-theme') === 'true';
    } catch {
      return false;
    }
  }

  toggleAutoTheme(enabled) {
    try {
      localStorage.setItem('todo-auto-theme', enabled.toString());
      
      if (enabled) {
        // Apply system theme immediately
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
      }
    } catch (error) {
      console.warn('Failed to save auto theme preference:', error);
    }
  }

  updateMetaThemeColor(themeName) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }

    // Get theme color from CSS custom property
    const colors = {
      light: '#2563eb',
      dark: '#1e293b',
      blue: '#0ea5e9',
      green: '#059669',
      purple: '#7c3aed'
    };

    metaThemeColor.content = colors[themeName] || colors.light;
  }

  // Custom theme creation
  createCustomTheme(name, cssVariables) {
    // Add custom theme to available themes
    this.themes[name] = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      icon: '🎨',
      custom: true
    };

    // Create CSS for custom theme
    const style = document.createElement('style');
    style.id = `theme-${name}`;
    
    const cssRules = Object.entries(cssVariables)
      .map(([prop, value]) => `  --${prop}: ${value};`)
      .join('\n');

    style.textContent = `
      .theme-${name} {
      ${cssRules}
      }
    `;

    document.head.appendChild(style);
    
    // Save custom theme data
    try {
      const customThemes = JSON.parse(localStorage.getItem('todo-custom-themes') || '{}');
      customThemes[name] = { cssVariables, icon: '🎨' };
      localStorage.setItem('todo-custom-themes', JSON.stringify(customThemes));
    } catch (error) {
      console.warn('Failed to save custom theme:', error);
    }
  }

  loadCustomThemes() {
    try {
      const customThemes = JSON.parse(localStorage.getItem('todo-custom-themes') || '{}');
      
      Object.entries(customThemes).forEach(([name, data]) => {
        this.createCustomTheme(name, data.cssVariables);
      });
    } catch (error) {
      console.warn('Failed to load custom themes:', error);
    }
  }

  deleteCustomTheme(name) {
    if (!this.themes[name] || !this.themes[name].custom) {
      return false;
    }

    // Remove from themes
    delete this.themes[name];

    // Remove CSS
    const style = document.getElementById(`theme-${name}`);
    if (style) {
      style.remove();
    }

    // Remove from storage
    try {
      const customThemes = JSON.parse(localStorage.getItem('todo-custom-themes') || '{}');
      delete customThemes[name];
      localStorage.setItem('todo-custom-themes', JSON.stringify(customThemes));
    } catch (error) {
      console.warn('Failed to delete custom theme from storage:', error);
    }

    // Switch to default theme if current theme was deleted
    if (this.currentTheme === name) {
      this.setTheme('light');
    }

    return true;
  }

  // Theme utilities
  getCurrentTheme() {
    return {
      name: this.currentTheme,
      data: this.themes[this.currentTheme]
    };
  }

  getAvailableThemes() {
    return Object.entries(this.themes).map(([key, data]) => ({
      key,
      ...data
    }));
  }

  exportThemeSettings() {
    return {
      currentTheme: this.currentTheme,
      autoTheme: this.getAutoThemeEnabled(),
      customThemes: JSON.parse(localStorage.getItem('todo-custom-themes') || '{}')
    };
  }

  importThemeSettings(settings) {
    if (settings.customThemes) {
      localStorage.setItem('todo-custom-themes', JSON.stringify(settings.customThemes));
      this.loadCustomThemes();
    }

    if (settings.autoTheme !== undefined) {
      localStorage.setItem('todo-auto-theme', settings.autoTheme.toString());
    }

    if (settings.currentTheme && this.themes[settings.currentTheme]) {
      this.setTheme(settings.currentTheme);
    }
  }

  // High contrast mode detection
  setupAccessibilityFeatures() {
    // Detect high contrast mode
    if (window.matchMedia) {
      const highContrast = window.matchMedia('(prefers-contrast: high)');
      
      const handleContrastChange = (e) => {
        document.body.classList.toggle('high-contrast', e.matches);
      };

      if (highContrast.addEventListener) {
        highContrast.addEventListener('change', handleContrastChange);
      } else {
        highContrast.addListener(handleContrastChange);
      }

      // Initial check
      handleContrastChange(highContrast);
    }

    // Detect reduced motion preference
    if (window.matchMedia) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      
      const handleMotionChange = (e) => {
        document.body.classList.toggle('reduced-motion', e.matches);
      };

      if (reducedMotion.addEventListener) {
        reducedMotion.addEventListener('change', handleMotionChange);
      } else {
        reducedMotion.addListener(handleMotionChange);
      }

      // Initial check
      handleMotionChange(reducedMotion);
    }
  }
}

// Initialize accessibility features when theme manager is created
document.addEventListener('DOMContentLoaded', () => {
  if (window.todoApp && window.todoApp.themes) {
    window.todoApp.themes.setupAccessibilityFeatures();
  }
});