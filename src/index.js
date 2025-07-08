// Import styles
import './styles/main.css';

// Import main class
import { VirtualAdvisor } from './core/VirtualAdvisor.js';

// Export constants for external use
export { STATES, EVENTS, DEFAULT_CONFIG, ERRORS } from './utils/constants.js';

// Export main class
export { VirtualAdvisor };

// Export as default for easier importing
export default VirtualAdvisor;

// Global namespace for UMD builds
if (typeof window !== 'undefined') {
  window.VirtualAdvisor = VirtualAdvisor;
}

// Auto-init if config is provided via data attributes
document.addEventListener('DOMContentLoaded', () => {
  // Check for auto-init script tag
  const script = document.querySelector('script[data-virtual-advisor]');
  if (script) {
    try {
      const config = JSON.parse(script.getAttribute('data-virtual-advisor') || '{}');
  
      new VirtualAdvisor(config);
    } catch (error) {
      console.error('VirtualAdvisor: Auto-init failed:', error);
    }
  }
});