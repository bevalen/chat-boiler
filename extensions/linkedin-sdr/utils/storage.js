/**
 * Storage utilities for the LinkedIn SDR extension
 */

const STORAGE_KEYS = {
  AUTH_TOKEN: 'maia_auth_token',
  USER_ID: 'maia_user_id',
  AGENT_ID: 'maia_agent_id',
  API_URL: 'maia_api_url',
  SETTINGS: 'maia_settings',
  TOKEN_EXPIRES_AT: 'maia_token_expires_at',
};

/**
 * Save authentication data
 */
export async function saveAuthData(data) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.AUTH_TOKEN]: data.token,
    [STORAGE_KEYS.USER_ID]: data.userId,
    [STORAGE_KEYS.AGENT_ID]: data.agentId,
    [STORAGE_KEYS.TOKEN_EXPIRES_AT]: data.expiresAt,
  });
}

/**
 * Get authentication data
 */
export async function getAuthData() {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_ID,
    STORAGE_KEYS.AGENT_ID,
    STORAGE_KEYS.TOKEN_EXPIRES_AT,
  ]);
  
  return {
    token: data[STORAGE_KEYS.AUTH_TOKEN],
    userId: data[STORAGE_KEYS.USER_ID],
    agentId: data[STORAGE_KEYS.AGENT_ID],
    expiresAt: data[STORAGE_KEYS.TOKEN_EXPIRES_AT],
  };
}

/**
 * Check if authenticated
 */
export async function isAuthenticated() {
  const auth = await getAuthData();
  if (!auth.token) return false;
  
  // Check if token is expired
  if (auth.expiresAt) {
    const expiry = new Date(auth.expiresAt);
    if (expiry < new Date()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Clear authentication data
 */
export async function clearAuthData() {
  await chrome.storage.sync.remove([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_ID,
    STORAGE_KEYS.AGENT_ID,
    STORAGE_KEYS.TOKEN_EXPIRES_AT,
  ]);
}

/**
 * Save API URL
 */
export async function saveApiUrl(url) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.API_URL]: url,
  });
}

/**
 * Get API URL (defaults to production)
 */
export async function getApiUrl() {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.API_URL);
  return data[STORAGE_KEYS.API_URL] || 'https://your-domain.com';
}

/**
 * Save settings
 */
export async function saveSettings(settings) {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: settings,
  });
}

/**
 * Get settings with defaults
 */
export async function getSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const settings = data[STORAGE_KEYS.SETTINGS] || {};
  
  // Return with defaults
  return {
    autoSend: settings.autoSend ?? false,
    draftMode: settings.draftMode ?? true,
    responseDelaySeconds: settings.responseDelaySeconds ?? 3,
    activeHoursOnly: settings.activeHoursOnly ?? false,
    activeHoursStart: settings.activeHoursStart ?? '09:00',
    activeHoursEnd: settings.activeHoursEnd ?? '17:00',
    activeDays: settings.activeDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    debugMode: settings.debugMode ?? false,
    enabled: settings.enabled ?? true,
  };
}

/**
 * Update a single setting
 */
export async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await saveSettings(settings);
  return settings;
}

export { STORAGE_KEYS };
