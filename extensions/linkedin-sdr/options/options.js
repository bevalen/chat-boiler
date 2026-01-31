/**
 * MAIA LinkedIn SDR - Options Page Script
 */

class OptionsController {
  constructor() {
    this.elements = {
      apiUrl: document.getElementById('api-url'),
      connectionStatus: document.getElementById('connection-status'),
      reconnectBtn: document.getElementById('reconnect-btn'),
      enabledToggle: document.getElementById('enabled-toggle'),
      draftModeToggle: document.getElementById('draft-mode-toggle'),
      responseDelay: document.getElementById('response-delay'),
      activeHoursToggle: document.getElementById('active-hours-toggle'),
      hoursStart: document.getElementById('hours-start'),
      hoursEnd: document.getElementById('hours-end'),
      hoursRow: document.getElementById('hours-row'),
      daysRow: document.getElementById('days-row'),
      dayCheckboxes: document.querySelectorAll('input[name="days"]'),
      debugToggle: document.getElementById('debug-toggle'),
      resetBtn: document.getElementById('reset-btn'),
      toast: document.getElementById('toast'),
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.checkConnection();
    this.setupEventListeners();
  }

  async loadSettings() {
    const { settings } = await this.sendMessage({ type: 'GET_SETTINGS' });
    const auth = await this.sendMessage({ type: 'GET_AUTH' });
    
    // API URL
    if (auth.apiUrl) {
      this.elements.apiUrl.value = auth.apiUrl;
    }
    
    // Toggles
    this.elements.enabledToggle.checked = settings.enabled !== false;
    this.elements.draftModeToggle.checked = settings.draftMode !== false;
    this.elements.activeHoursToggle.checked = settings.activeHoursOnly ?? false;
    this.elements.debugToggle.checked = settings.debugMode ?? false;
    
    // Response delay
    this.elements.responseDelay.value = settings.responseDelaySeconds ?? 3;
    
    // Active hours
    this.elements.hoursStart.value = settings.activeHoursStart ?? '09:00';
    this.elements.hoursEnd.value = settings.activeHoursEnd ?? '17:00';
    
    // Active days
    const activeDays = settings.activeDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    this.elements.dayCheckboxes.forEach(checkbox => {
      checkbox.checked = activeDays.includes(checkbox.value);
    });
    
    // Update visibility of hours settings
    this.updateHoursVisibility();
  }

  async checkConnection() {
    const { authenticated } = await this.sendMessage({ type: 'CHECK_AUTH' });
    
    if (authenticated) {
      this.elements.connectionStatus.textContent = 'Connected';
      this.elements.connectionStatus.style.color = '#28a745';
    } else {
      this.elements.connectionStatus.textContent = 'Not connected';
      this.elements.connectionStatus.style.color = '#dc3545';
    }
  }

  setupEventListeners() {
    // API URL change
    this.elements.apiUrl.addEventListener('change', async () => {
      await this.sendMessage({ type: 'SET_API_URL', apiUrl: this.elements.apiUrl.value });
      this.showToast('API URL saved');
    });

    // Reconnect button
    this.elements.reconnectBtn.addEventListener('click', () => {
      this.handleReconnect();
    });

    // Toggle changes
    this.elements.enabledToggle.addEventListener('change', () => this.saveSettings());
    this.elements.draftModeToggle.addEventListener('change', () => this.saveSettings());
    this.elements.debugToggle.addEventListener('change', () => this.saveSettings());
    
    // Active hours toggle
    this.elements.activeHoursToggle.addEventListener('change', () => {
      this.updateHoursVisibility();
      this.saveSettings();
    });

    // Response delay
    this.elements.responseDelay.addEventListener('change', () => this.saveSettings());

    // Hours inputs
    this.elements.hoursStart.addEventListener('change', () => this.saveSettings());
    this.elements.hoursEnd.addEventListener('change', () => this.saveSettings());

    // Day checkboxes
    this.elements.dayCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.saveSettings());
    });

    // Reset button
    this.elements.resetBtn.addEventListener('click', () => this.handleReset());
  }

  updateHoursVisibility() {
    const show = this.elements.activeHoursToggle.checked;
    this.elements.hoursRow.style.display = show ? 'flex' : 'none';
    this.elements.daysRow.style.display = show ? 'flex' : 'none';
  }

  async saveSettings() {
    const settings = {
      enabled: this.elements.enabledToggle.checked,
      draftMode: this.elements.draftModeToggle.checked,
      responseDelaySeconds: parseInt(this.elements.responseDelay.value, 10) || 3,
      activeHoursOnly: this.elements.activeHoursToggle.checked,
      activeHoursStart: this.elements.hoursStart.value,
      activeHoursEnd: this.elements.hoursEnd.value,
      activeDays: Array.from(this.elements.dayCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value),
      debugMode: this.elements.debugToggle.checked,
    };

    await this.sendMessage({ type: 'SAVE_SETTINGS', settings });
    this.showToast('Settings saved');

    // Notify content scripts of settings change
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', settings });
      } catch (e) {
        // Tab might not have content script loaded
      }
    }
  }

  async handleReconnect() {
    const apiUrl = this.elements.apiUrl.value.trim();
    
    if (!apiUrl) {
      alert('Please enter your MAIA server URL');
      return;
    }

    // Open login page
    const loginUrl = `${apiUrl}/login?extension=true&redirect=${encodeURIComponent('/settings/channels')}`;
    chrome.tabs.create({ url: loginUrl });
  }

  async handleReset() {
    const confirmed = confirm(
      'This will disconnect from MAIA and reset all settings to defaults. Are you sure?'
    );
    
    if (!confirmed) return;

    // Clear auth
    await this.sendMessage({ type: 'CLEAR_AUTH' });
    
    // Reset settings to defaults
    const defaultSettings = {
      enabled: true,
      draftMode: true,
      responseDelaySeconds: 3,
      activeHoursOnly: false,
      activeHoursStart: '09:00',
      activeHoursEnd: '17:00',
      activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      debugMode: false,
    };
    
    await this.sendMessage({ type: 'SAVE_SETTINGS', settings: defaultSettings });
    
    // Reload settings
    await this.loadSettings();
    await this.checkConnection();
    
    this.showToast('Extension reset to defaults');
  }

  showToast(message) {
    this.elements.toast.textContent = message;
    this.elements.toast.classList.add('show');
    
    setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 3000);
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
