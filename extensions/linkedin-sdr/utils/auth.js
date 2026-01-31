/**
 * Authentication utilities for the MAIA LinkedIn SDR extension
 */

import { saveAuthData, getAuthData, clearAuthData, getApiUrl } from './storage.js';

/**
 * Generate extension token by calling the MAIA API
 * User must already be logged into the MAIA web app
 */
export async function generateExtensionToken(settings = {}) {
  const apiUrl = await getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/api/auth/extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for auth
      body: JSON.stringify({
        extensionId: chrome.runtime.id,
        settings,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate token');
    }
    
    const data = await response.json();
    
    // Save auth data
    await saveAuthData({
      token: data.token,
      userId: data.userId,
      agentId: data.agentId,
      expiresAt: data.expiresAt,
    });
    
    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error('[MAIA] Auth error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if current token is valid
 */
export async function validateToken() {
  const auth = await getAuthData();
  
  if (!auth.token) {
    return { valid: false, reason: 'no_token' };
  }
  
  // Check expiry
  if (auth.expiresAt) {
    const expiry = new Date(auth.expiresAt);
    if (expiry < new Date()) {
      return { valid: false, reason: 'expired' };
    }
  }
  
  // Optionally verify with server
  const apiUrl = await getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/api/auth/extension`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
      },
    });
    
    if (!response.ok) {
      return { valid: false, reason: 'server_rejected' };
    }
    
    const data = await response.json();
    return {
      valid: data.isActive && !data.isExpired,
      reason: data.isExpired ? 'expired' : (data.isActive ? 'valid' : 'inactive'),
      ...data,
    };
  } catch (error) {
    console.error('[MAIA] Token validation error:', error);
    // If we can't reach the server, assume token is valid if not expired
    return { valid: true, reason: 'offline_assumed_valid' };
  }
}

/**
 * Revoke the current token
 */
export async function revokeToken() {
  const auth = await getAuthData();
  const apiUrl = await getApiUrl();
  
  if (auth.token) {
    try {
      await fetch(`${apiUrl}/api/auth/extension`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
      });
    } catch (error) {
      console.error('[MAIA] Error revoking token:', error);
    }
  }
  
  await clearAuthData();
  return { success: true };
}

/**
 * Refresh token if needed
 */
export async function refreshTokenIfNeeded() {
  const auth = await getAuthData();
  
  if (!auth.token || !auth.expiresAt) {
    return { refreshed: false, reason: 'no_token' };
  }
  
  const expiry = new Date(auth.expiresAt);
  const now = new Date();
  const daysUntilExpiry = (expiry - now) / (1000 * 60 * 60 * 24);
  
  // Refresh if less than 2 days until expiry
  if (daysUntilExpiry < 2) {
    const result = await generateExtensionToken();
    return { refreshed: result.success, ...result };
  }
  
  return { refreshed: false, reason: 'not_needed' };
}

/**
 * Open MAIA login page for authentication
 */
export function openLoginPage() {
  return new Promise(async (resolve) => {
    const apiUrl = await getApiUrl();
    const loginUrl = `${apiUrl}/login?extension=true&redirect=/settings/channels`;
    
    // Open login page in new tab
    chrome.tabs.create({ url: loginUrl }, (tab) => {
      resolve(tab);
    });
  });
}
