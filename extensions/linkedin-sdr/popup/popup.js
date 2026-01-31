/**
 * MAIA LinkedIn SDR - Popup Script
 */

class PopupController {
  constructor() {
    this.elements = {
      statusBadge: document.getElementById('status-badge'),
      notConnected: document.getElementById('not-connected'),
      connected: document.getElementById('connected'),
      apiUrl: document.getElementById('api-url'),
      connectBtn: document.getElementById('connect-btn'),
      enabledToggle: document.getElementById('enabled-toggle'),
      draftModeToggle: document.getElementById('draft-mode-toggle'),
      settingsBtn: document.getElementById('settings-btn'),
      disconnectBtn: document.getElementById('disconnect-btn'),
      helpLink: document.getElementById('help-link'),
      messagesToday: document.getElementById('messages-today'),
      meetingsBooked: document.getElementById('meetings-booked'),
    };

    this.init();
  }

  async init() {
    await this.loadState();
    this.setupEventListeners();
  }

  async loadState() {
    // Check authentication status
    const { authenticated } = await this.sendMessage({ type: 'CHECK_AUTH' });
    
    if (authenticated) {
      this.showConnectedState();
      await this.loadSettings();
    } else {
      this.showNotConnectedState();
      await this.loadApiUrl();
    }
  }

  async loadSettings() {
    const { settings } = await this.sendMessage({ type: 'GET_SETTINGS' });
    
    if (settings) {
      this.elements.enabledToggle.checked = settings.enabled !== false;
      this.elements.draftModeToggle.checked = settings.draftMode !== false;
    }
  }

  async loadApiUrl() {
    const auth = await this.sendMessage({ type: 'GET_AUTH' });
    if (auth.apiUrl) {
      this.elements.apiUrl.value = auth.apiUrl;
    }
  }

  showConnectedState() {
    this.elements.statusBadge.className = 'status-badge connected';
    this.elements.statusBadge.textContent = 'Connected';
    this.elements.notConnected.style.display = 'none';
    this.elements.connected.style.display = 'block';
  }

  showNotConnectedState() {
    this.elements.statusBadge.className = 'status-badge disconnected';
    this.elements.statusBadge.textContent = 'Disconnected';
    this.elements.notConnected.style.display = 'block';
    this.elements.connected.style.display = 'none';
  }

  setupEventListeners() {
    // Connect button
    this.elements.connectBtn.addEventListener('click', async () => {
      await this.handleConnect();
    });

    // Enabled toggle
    this.elements.enabledToggle.addEventListener('change', async (e) => {
      await this.updateSetting('enabled', e.target.checked);
      
      // Notify content script
      const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_ENABLED',
          enabled: e.target.checked,
        });
      }
    });

    // Draft mode toggle
    this.elements.draftModeToggle.addEventListener('change', async (e) => {
      await this.updateSetting('draftMode', e.target.checked);
    });

    // Settings button
    this.elements.settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Disconnect button
    this.elements.disconnectBtn.addEventListener('click', async () => {
      await this.handleDisconnect();
    });

    // Help link
    this.elements.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://docs.maia.ai/linkedin-sdr' });
    });
  }

  async handleConnect() {
    const apiUrl = this.elements.apiUrl.value.trim();
    
    if (!apiUrl) {
      alert('Please enter your MAIA server URL');
      return;
    }

    // Validate URL format
    try {
      new URL(apiUrl);
    } catch {
      alert('Please enter a valid URL');
      return;
    }

    // Save API URL
    await this.sendMessage({ type: 'SET_API_URL', apiUrl });

    // Open login page
    const loginUrl = `${apiUrl}/login?extension=true&redirect=${encodeURIComponent('/settings/channels')}`;
    
    // Open in new tab
    chrome.tabs.create({ url: loginUrl }, (tab) => {
      // Listen for the tab to navigate to the success page
      const checkInterval = setInterval(async () => {
        try {
          const currentTab = await chrome.tabs.get(tab.id);
          
          // Check if we're on the channels settings page (indicating successful auth)
          if (currentTab.url && currentTab.url.includes('/settings/channels')) {
            clearInterval(checkInterval);
            
            // Try to generate token
            await this.generateToken(apiUrl);
          }
        } catch (e) {
          // Tab closed
          clearInterval(checkInterval);
        }
      }, 1000);

      // Stop checking after 5 minutes
      setTimeout(() => clearInterval(checkInterval), 300000);
    });
  }

  async generateToken(apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          extensionId: chrome.runtime.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate token');
      }

      const data = await response.json();

      // Save auth data
      await this.sendMessage({
        type: 'SAVE_AUTH',
        token: data.token,
        userId: data.userId,
        agentId: data.agentId,
        apiUrl: apiUrl,
        expiresAt: data.expiresAt,
      });

      // Update UI
      this.showConnectedState();
      await this.loadSettings();

      // Show success message
      alert('Successfully connected to MAIA!');
    } catch (error) {
      console.error('Auth error:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  }

  async handleDisconnect() {
    const confirmed = confirm('Are you sure you want to disconnect from MAIA?');
    
    if (confirmed) {
      await this.sendMessage({ type: 'CLEAR_AUTH' });
      this.showNotConnectedState();
    }
  }

  async updateSetting(key, value) {
    const { settings } = await this.sendMessage({ type: 'GET_SETTINGS' });
    settings[key] = value;
    await this.sendMessage({ type: 'SAVE_SETTINGS', settings });
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
