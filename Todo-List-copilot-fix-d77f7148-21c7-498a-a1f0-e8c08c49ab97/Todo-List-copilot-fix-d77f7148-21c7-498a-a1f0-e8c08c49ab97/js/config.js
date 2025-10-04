// Runtime configuration for backend integration
// Adjust this if you deploy the Node backend to a remote host.
window.TODO_API_BASE = window.TODO_API_BASE || (location.hostname === 'localhost' ? 'http://localhost:8080' : '');

// Helper to check if remote backend is enabled
window.hasRemoteBackend = () => !!window.TODO_API_BASE;
