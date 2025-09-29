// Onboarding Tour Manager
class TourManager {
  constructor(app) {
    this.app = app;
    this.currentStep = 0;
    this.isActive = false;
    this.steps = this.getTourSteps();
    
    this.setupEventListeners();
  }

  getTourSteps() {
    return [
      {
        title: "Welcome to Todo PWA! 🎉",
        description: "Let's take a quick tour to get you started with managing your tasks effectively.",
        target: null,
        position: 'center'
      },
      {
        title: "Add Your First Task",
        description: "Click here to create a new task. You can add a title, description, due date, priority, and tags.",
        target: '#addTaskBtn',
        position: 'bottom'
      },
      {
        title: "Search & Filter",
        description: "Use the search bar to find tasks quickly. You can search by title, tags, or special keywords like 'completed', 'overdue', or 'high'.",
        target: '#searchInput',
        position: 'bottom'
      },
      {
        title: "Filter by Status & Tags",
        description: "Use these filters to view specific types of tasks. Filter by completion status, tags, or sort by different criteria.",
        target: '.filter-container',
        position: 'bottom'
      },
      {
        title: "Task Actions",
        description: "Each task has quick actions: check to complete, edit inline by double-clicking the title, or use the action buttons.",
        target: '.task-list',
        position: 'top',
        conditional: () => this.app.tasks.length > 0
      },
      {
        title: "Drag to Reorder",
        description: "You can drag tasks to reorder them. This is useful for prioritizing your work.",
        target: '.task-list',
        position: 'top',
        conditional: () => this.app.tasks.length > 1
      },
      {
        title: "Statistics Dashboard",
        description: "View your productivity stats, completion rates, and insights about your task management habits.",
        target: '#statsBtn',
        position: 'bottom'
      },
      {
        title: "Task Relations",
        description: "Visualize how your tasks are connected. Tasks with shared tags or explicit relations will be shown in a network graph.",
        target: '#relationshipBtn',
        position: 'bottom'
      },
      {
        title: "Themes & Settings",
        description: "Toggle between light and dark themes, or access advanced features like import/export and undo/redo.",
        target: '#themeBtn',
        position: 'bottom'
      },
      {
        title: "Menu Options",
        description: "Access import/export, undo/redo, and other advanced features from this menu.",
        target: '#menuBtn',
        position: 'bottom'
      },
      {
        title: "You're All Set! 🚀",
        description: "That's it! Start adding tasks and watch your productivity soar. You can replay this tour anytime from the help button.",
        target: null,
        position: 'center'
      }
    ];
  }

  setupEventListeners() {
    document.getElementById('skipTour').addEventListener('click', () => {
      this.stop();
    });

    document.getElementById('nextTour').addEventListener('click', () => {
      this.nextStep();
    });

    // Close tour on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.stop();
      }
    });

    // Close tour when clicking overlay (but not the content)
    document.getElementById('tourOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'tourOverlay') {
        this.stop();
      }
    });
  }

  async start() {
    // Check if tour was already completed
    const tourCompleted = await this.app.storage.getSetting('tourCompleted', false);
    
    if (tourCompleted && !confirm('You\'ve already completed the tour. Would you like to see it again?')) {
      return;
    }

    this.isActive = true;
    this.currentStep = 0;
    this.showStep(0);
  }

  stop() {
    this.isActive = false;
    this.hideOverlay();
    this.removeHighlights();
    
    // Mark tour as completed
    this.app.storage.setSetting('tourCompleted', true);
  }

  nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.showStep(this.currentStep);
    } else {
      this.stop();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.showStep(this.currentStep);
    }
  }

  showStep(stepIndex) {
    const step = this.steps[stepIndex];
    
    // Skip steps with unfulfilled conditions
    if (step.conditional && !step.conditional()) {
      if (stepIndex < this.steps.length - 1) {
        this.currentStep++;
        this.showStep(this.currentStep);
      } else {
        this.stop();
      }
      return;
    }

    this.removeHighlights();
    
    // Update tour content
    document.getElementById('tourTitle').textContent = step.title;
    document.getElementById('tourDescription').textContent = step.description;
    
    // Update buttons
    const skipBtn = document.getElementById('skipTour');
    const nextBtn = document.getElementById('nextTour');
    
    if (stepIndex === this.steps.length - 1) {
      nextBtn.textContent = 'Finish';
      skipBtn.style.display = 'none';
    } else {
      nextBtn.textContent = 'Next';
      skipBtn.style.display = 'inline-flex';
    }

    // Show overlay
    this.showOverlay();
    
    // Highlight target element
    if (step.target) {
      this.highlightElement(step.target, step.position);
    }

    // Add step indicator
    this.updateStepIndicator(stepIndex);
  }

  showOverlay() {
    const overlay = document.getElementById('tourOverlay');
    overlay.classList.remove('hidden');
    
    // Add animation
    overlay.style.animation = 'fadeIn 0.3s ease-out';
  }

  hideOverlay() {
    const overlay = document.getElementById('tourOverlay');
    overlay.classList.add('hidden');
  }

  highlightElement(selector, position) {
    const element = document.querySelector(selector);
    if (!element) return;

    // Create highlight overlay
    const highlight = document.createElement('div');
    highlight.className = 'tour-highlight';
    highlight.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 3px solid var(--primary-color);
      border-radius: var(--border-radius);
      z-index: 1999;
      animation: pulse 2s infinite;
      box-shadow: 0 0 20px var(--primary-color);
    `;

    const rect = element.getBoundingClientRect();
    highlight.style.top = (rect.top - 5) + 'px';
    highlight.style.left = (rect.left - 5) + 'px';
    highlight.style.width = (rect.width + 10) + 'px';
    highlight.style.height = (rect.height + 10) + 'px';

    document.body.appendChild(highlight);

    // Position tour content near the highlighted element
    this.positionTourContent(rect, position);

    // Scroll element into view
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
  }

  positionTourContent(targetRect, position) {
    const tourStep = document.querySelector('.tour-step');
    const overlay = document.getElementById('tourOverlay');
    
    // Reset overlay positioning
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    
    if (position === 'center') return;

    // Calculate position
    let top, left;
    const margin = 20;
    const tourRect = tourStep.getBoundingClientRect();
    
    switch (position) {
      case 'top':
        top = targetRect.top - tourRect.height - margin;
        left = targetRect.left + (targetRect.width - tourRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + margin;
        left = targetRect.left + (targetRect.width - tourRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tourRect.height) / 2;
        left = targetRect.left - tourRect.width - margin;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tourRect.height) / 2;
        left = targetRect.right + margin;
        break;
    }

    // Ensure tour content stays in viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - tourRect.height - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - tourRect.width - margin));

    tourStep.style.position = 'fixed';
    tourStep.style.top = top + 'px';
    tourStep.style.left = left + 'px';
    
    overlay.style.justifyContent = 'flex-start';
    overlay.style.alignItems = 'flex-start';
  }

  removeHighlights() {
    document.querySelectorAll('.tour-highlight').forEach(el => el.remove());
    
    // Reset tour content positioning
    const tourStep = document.querySelector('.tour-step');
    tourStep.style.position = 'static';
    tourStep.style.top = 'auto';
    tourStep.style.left = 'auto';
  }

  updateStepIndicator(currentStep) {
    // Add or update step indicator
    let indicator = document.querySelector('.tour-step-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'tour-step-indicator';
      indicator.style.cssText = `
        text-align: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-color);
        font-size: 0.8rem;
        color: var(--text-muted);
      `;
      document.querySelector('.tour-content').appendChild(indicator);
    }

    const totalSteps = this.steps.length;
    const progress = Math.round(((currentStep + 1) / totalSteps) * 100);
    
    indicator.innerHTML = `
      <div>Step ${currentStep + 1} of ${totalSteps}</div>
      <div style="margin-top: 0.5rem;">
        <div style="
          background: var(--bg-tertiary);
          height: 4px;
          border-radius: 2px;
          overflow: hidden;
        ">
          <div style="
            background: var(--primary-color);
            height: 100%;
            width: ${progress}%;
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
  }

  // Advanced tour features
  addCustomStep(step) {
    this.steps.push(step);
  }

  setStepCondition(stepIndex, condition) {
    if (this.steps[stepIndex]) {
      this.steps[stepIndex].conditional = condition;
    }
  }

  jumpToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.currentStep = stepIndex;
      this.showStep(stepIndex);
    }
  }

  // Interactive tour features
  waitForAction(action, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Tour action timeout'));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutId);
        document.removeEventListener(action.type, handler);
      };

      const handler = (e) => {
        if (action.selector && !e.target.matches(action.selector)) return;
        cleanup();
        resolve(e);
      };

      document.addEventListener(action.type, handler);
    });
  }

  async interactiveStep(step) {
    this.showStep(this.currentStep);
    
    if (step.waitFor) {
      try {
        await this.waitForAction(step.waitFor);
        // Action completed, proceed to next step
        this.nextStep();
      } catch (error) {
        // Timeout or error, show hint or skip
        this.showHint(step.hint || 'Try clicking the highlighted element to continue.');
      }
    }
  }

  showHint(message) {
    const hint = document.createElement('div');
    hint.className = 'tour-hint';
    hint.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--warning-color);
      color: white;
      padding: 1rem;
      border-radius: var(--border-radius);
      z-index: 2001;
      animation: slideIn 0.3s ease-out;
    `;
    hint.textContent = message;
    
    document.body.appendChild(hint);
    
    setTimeout(() => {
      hint.remove();
    }, 3000);
  }

  // Tour analytics
  getTourAnalytics() {
    return {
      stepsCompleted: this.currentStep,
      totalSteps: this.steps.length,
      completionRate: Math.round((this.currentStep / this.steps.length) * 100),
      tourCompleted: this.currentStep === this.steps.length - 1
    };
  }

  // Export tour data for customization
  exportTourData() {
    return {
      steps: this.steps,
      settings: {
        autoStart: false,
        skipEnabled: true,
        keyboardNavigation: true
      }
    };
  }

  // Import custom tour
  importTourData(data) {
    if (data.steps && Array.isArray(data.steps)) {
      this.steps = data.steps;
    }
  }
}

// Add CSS animations for tour
const tourStyles = document.createElement('style');
tourStyles.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideIn {
    from { transform: translate(-50%, -60%); opacity: 0; }
    to { transform: translate(-50%, -50%); opacity: 1; }
  }
  
  .tour-highlight {
    box-shadow: 0 0 20px rgba(37, 99, 235, 0.5);
  }
`;
document.head.appendChild(tourStyles);