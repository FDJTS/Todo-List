# Todo List App

A modern, feature-rich todo list application built with vanilla HTML, CSS, and JavaScript. This application addresses common pain points in task management with performance optimizations, accessibility features, and a polished user experience.

## Features

### Core Functionality
- ✅ Add, edit, delete, and complete tasks
- 🏷️ Tag system for task organization
- 🔍 Advanced search and filtering
- 📱 Responsive design (mobile-friendly)
- 💾 Local storage persistence
- 📊 Task statistics and progress tracking

### Performance & Reliability
- ⚡ Optimized for large datasets with virtual scrolling
- 🔄 Offline functionality with Service Worker
- 📤 Import/Export capabilities
- 🧪 Comprehensive test coverage
- 🛡️ XSS protection and input validation

### User Experience
- 🌙 Dark/Light theme support
- ♿ Accessibility compliant (WCAG 2.1)
- 🔔 Browser notifications for reminders
- ⌨️ Keyboard shortcuts
- 🎨 Multiple color themes

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari 12+, Chrome Mobile 60+)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/FDJTS/Todo-List.git
cd Todo-List
```

2. Open `index.html` in your browser or serve it locally:
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

3. Visit `http://localhost:8000` in your browser

## Architecture

### File Structure
```
Todo-List/
├── index.html          # Main application HTML
├── css/
│   ├── styles.css      # Main stylesheet
│   ├── themes.css      # Theme variations
│   └── responsive.css  # Mobile responsiveness
├── js/
│   ├── app.js          # Main application logic
│   ├── storage.js      # Local storage management
│   ├── ui.js           # UI components and interactions
│   ├── notifications.js # Notification system
│   └── utils.js        # Utility functions
├── sw.js               # Service Worker for offline functionality
├── manifest.json       # PWA manifest
├── tests/
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
└── docs/               # Additional documentation
```

### Key Components

- **TaskManager**: Core class handling task CRUD operations
- **StorageManager**: Handles local storage and data persistence
- **UIManager**: Manages DOM updates and user interactions
- **NotificationManager**: Handles browser notifications and reminders
- **ThemeManager**: Manages dark/light themes and customization

## API Reference

### TaskManager Class

```javascript
// Create a new task
taskManager.addTask({
  title: 'Task title',
  description: 'Task description',
  tags: ['work', 'urgent'],
  dueDate: '2024-12-31',
  priority: 'high'
});

// Update a task
taskManager.updateTask(taskId, {
  title: 'Updated title',
  completed: true
});

// Delete a task
taskManager.deleteTask(taskId);

// Search tasks
taskManager.searchTasks('query', {
  tags: ['work'],
  completed: false,
  priority: 'high'
});
```

## Performance Considerations

### Large Dataset Optimization
- **Virtual Scrolling**: Only renders visible tasks to handle 10,000+ tasks smoothly
- **Debounced Search**: Search input is debounced to prevent excessive filtering
- **Lazy Loading**: Task details loaded on demand
- **Efficient Storage**: Uses IndexedDB for large datasets (falls back to localStorage)

### Memory Management
- Event listeners are properly cleaned up
- DOM nodes are recycled in virtual scrolling
- Efficient data structures for fast lookups

## Testing

Run the test suite:

```bash
# Install dependencies (if using npm for testing tools)
npm install

# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm run test:coverage
```

### Test Coverage
- Unit tests for core functionality
- Integration tests for user workflows
- Performance tests for large datasets
- Accessibility tests

## Security

### Implemented Protections
- **XSS Prevention**: All user input is sanitized
- **Content Security Policy**: Strict CSP headers
- **Input Validation**: Client and server-side validation
- **Safe HTML Rendering**: Using textContent instead of innerHTML where possible

## Accessibility

### WCAG 2.1 Compliance
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels and roles
- **Color Contrast**: Meets AA standards
- **Focus Management**: Logical tab order
- **Alternative Text**: All images have alt text

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

### Coding Standards
- Use ES6+ JavaScript features
- Follow semantic HTML5 structure
- Use CSS custom properties for theming
- Write comprehensive tests for new features
- Maintain accessibility standards

## Roadmap

### Planned Features
- [ ] Cloud synchronization
- [ ] Team collaboration
- [ ] Calendar integration
- [ ] API for third-party integrations
- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] AI-powered task suggestions

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/FDJTS/Todo-List/issues)
- 💬 [Discussions](https://github.com/FDJTS/Todo-List/discussions)

## Acknowledgments

- Icons by [Heroicons](https://heroicons.com/)
- Inspiration from modern todo apps like Todoist and Microsoft To Do
- Community feedback and contributions