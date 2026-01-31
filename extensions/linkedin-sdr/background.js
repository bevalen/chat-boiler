/**
 * MAIA LinkedIn SDR - Background Service Worker
 * 
 * Handles:
 * 1. Communication between content script and MAIA API
 * 2. Authentication token management
 * 3. Settings management
 * 4. Message processing and streaming response handling
 */

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'maia_auth_token',
  USER_ID: 'maia_user_id',
  AGENT_ID: 'maia_agent_id',
  API_URL: 'maia_api_url',
  SETTINGS: 'maia_settings',
  TOKEN_EXPIRES_AT: 'maia_token_expires_at',
};

// Default API URL
const DEFAULT_API_URL = 'https://madewell-maia.vercel.app';

/**
 * Get settings from storage
 */
async function getSettings() {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const settings = data[STORAGE_KEYS.SETTINGS] || {};
  
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
 * Get auth data from storage
 */
async function getAuthData() {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_ID,
    STORAGE_KEYS.AGENT_ID,
    STORAGE_KEYS.API_URL,
    STORAGE_KEYS.TOKEN_EXPIRES_AT,
  ]);
  
  return {
    token: data[STORAGE_KEYS.AUTH_TOKEN],
    userId: data[STORAGE_KEYS.USER_ID],
    agentId: data[STORAGE_KEYS.AGENT_ID],
    apiUrl: data[STORAGE_KEYS.API_URL] || DEFAULT_API_URL,
    expiresAt: data[STORAGE_KEYS.TOKEN_EXPIRES_AT],
  };
}

/**
 * Check if authenticated
 */
async function isAuthenticated() {
  const auth = await getAuthData();
  if (!auth.token) return false;
  
  if (auth.expiresAt) {
    const expiry = new Date(auth.expiresAt);
    if (expiry < new Date()) return false;
  }
  
  return true;
}

/**
 * Check if within active hours
 */
async function isWithinActiveHours() {
  const settings = await getSettings();
  
  if (!settings.activeHoursOnly) return true;
  
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  
  // Check if today is an active day
  if (!settings.activeDays.includes(dayName)) {
    return false;
  }
  
  // Check if within active hours
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  return currentTime >= settings.activeHoursStart && currentTime <= settings.activeHoursEnd;
}

/**
 * Send message to MAIA chat API
 */
async function sendToMAIA(messageData) {
  const auth = await getAuthData();
  
  if (!auth.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  // Build messages array with history
  const messages = [];
  
  // Add conversation history
  if (messageData.allMessages && messageData.allMessages.length > 0) {
    // Take last 20 messages for context
    const history = messageData.allMessages.slice(-20);
    history.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
        parts: [{ type: 'text', text: msg.content }],
      });
    });
  }
  
  // Add current message (if not already in history)
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.content !== messageData.message) {
    messages.push({
      role: 'user',
      content: messageData.message,
      parts: [{ type: 'text', text: messageData.message }],
    });
  }

  const requestBody = {
    messages,
    userId: auth.userId,
    channelSource: 'linkedin',
    channelMetadata: {
      linkedin_conversation_id: messageData.conversationContext?.threadId,
      linkedin_profile_url: messageData.conversationContext?.profileUrl,
      linkedin_sender_name: messageData.conversationContext?.senderName,
    },
  };

  try {
    console.log('[MAIA BG] Sending to API:', auth.apiUrl);
    console.log('[MAIA BG] Token (first 20 chars):', auth.token?.substring(0, 20) + '...');
    console.log('[MAIA BG] Request body:', JSON.stringify(requestBody).substring(0, 500));
    
    const response = await fetch(`${auth.apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[MAIA BG] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MAIA BG] ❌ API error:', response.status, errorText);
      // Return the actual error message so content script can display it
      return { 
        success: false, 
        error: `API error: ${response.status} - ${errorText.substring(0, 200)}`,
        statusCode: response.status,
        errorDetails: errorText
      };
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let rawChunks = [];

    console.log('[MAIA BG] Starting to read stream...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[MAIA BG] Stream complete');
        break;
      }

      const chunk = decoder.decode(value);
      rawChunks.push(chunk);
      console.log('[MAIA BG] Raw chunk:', chunk.substring(0, 200));
      
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Handle SSE format (AI SDK uses various formats)
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() && jsonStr !== '[DONE]') {
              const data = JSON.parse(jsonStr);
              console.log('[MAIA BG] Parsed data:', data.type || 'no type');
              
              // Handle text-delta format
              if (data.type === 'text-delta' && data.textDelta) {
                fullResponse += data.textDelta;
              } else if (data.type === 'text-delta' && data.delta) {
                fullResponse += data.delta;
              }
              // Handle content format
              else if (data.type === 'content' && data.content) {
                fullResponse += data.content;
              }
              // Handle text format
              else if (data.text) {
                fullResponse += data.text;
              }
            }
          } catch (e) {
            console.log('[MAIA BG] Parse error for line:', line.substring(0, 100));
          }
        }
        // Handle format with prefixed numbers (0:, 1:, 2:, etc.)
        else if (/^\d+:/.test(line)) {
          try {
            const colonIndex = line.indexOf(':');
            const content = line.slice(colonIndex + 1);
            const parsed = JSON.parse(content);
            if (typeof parsed === 'string') {
              fullResponse += parsed;
            } else if (parsed.text) {
              fullResponse += parsed.text;
            } else if (parsed.textDelta) {
              fullResponse += parsed.textDelta;
            }
          } catch (e) {
            // Try to extract text directly
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
              const content = line.slice(colonIndex + 1).trim();
              if (content.startsWith('"') && content.endsWith('"')) {
                try {
                  fullResponse += JSON.parse(content);
                } catch (e2) {
                  // ignore
                }
              }
            }
          }
        }
      }
    }

    console.log('[MAIA BG] Full response length:', fullResponse.length);
    console.log('[MAIA BG] Response preview:', fullResponse.substring(0, 200) + '...');
    
    if (!fullResponse && rawChunks.length > 0) {
      console.log('[MAIA BG] ⚠️ WARNING: Got chunks but no parsed response. Raw data:', rawChunks.join('').substring(0, 500));
      // Try to extract any text from raw chunks
      const rawText = rawChunks.join('');
      // Check if there's an error in the raw response
      if (rawText.includes('error') || rawText.includes('Unauthorized')) {
        return { success: false, error: 'API returned error: ' + rawText.substring(0, 200) };
      }
    }
    
    if (!fullResponse || fullResponse.trim() === '') {
      console.log('[MAIA BG] ❌ No response generated - check Service Worker console for API errors');
      return { 
        success: false, 
        error: 'No response generated. Check if extension is connected properly.',
        debugInfo: {
          chunksReceived: rawChunks.length,
          rawPreview: rawChunks.join('').substring(0, 300)
        }
      };
    }
    
    console.log('[MAIA BG] ✅ Successfully generated response');
    return {
      success: true,
      response: fullResponse,
    };
  } catch (error) {
    console.error('[MAIA BG] Fetch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle messages from content script and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[MAIA BG] Received message:', message.type);
  
  switch (message.type) {
    case 'NEW_MESSAGE':
      handleNewMessage(message.data).then(sendResponse);
      return true; // Keep channel open for async response
      
    case 'GET_SETTINGS':
      getSettings().then(settings => sendResponse({ settings }));
      return true;
      
    case 'SAVE_SETTINGS':
      chrome.storage.sync.set({
        [STORAGE_KEYS.SETTINGS]: message.settings
      }).then(() => sendResponse({ success: true }));
      return true;
      
    case 'CHECK_AUTH':
      isAuthenticated().then(authenticated => sendResponse({ authenticated }));
      return true;
      
    case 'GET_AUTH':
      getAuthData().then(auth => sendResponse(auth));
      return true;
      
    case 'SAVE_AUTH':
      chrome.storage.sync.set({
        [STORAGE_KEYS.AUTH_TOKEN]: message.token,
        [STORAGE_KEYS.USER_ID]: message.userId,
        [STORAGE_KEYS.AGENT_ID]: message.agentId,
        [STORAGE_KEYS.API_URL]: message.apiUrl,
        [STORAGE_KEYS.TOKEN_EXPIRES_AT]: message.expiresAt,
      }).then(() => sendResponse({ success: true }));
      return true;
      
    case 'CLEAR_AUTH':
      chrome.storage.sync.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.AGENT_ID,
        STORAGE_KEYS.TOKEN_EXPIRES_AT,
      ]).then(() => sendResponse({ success: true }));
      return true;
      
    case 'SET_API_URL':
      chrome.storage.sync.set({
        [STORAGE_KEYS.API_URL]: message.apiUrl
      }).then(() => sendResponse({ success: true }));
      return true;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Handle new message from content script
 */
async function handleNewMessage(data) {
  // Check if we're authenticated
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { success: false, error: 'Not authenticated. Please connect MAIA in the extension popup.' };
  }
  
  // Check if enabled
  const settings = await getSettings();
  if (!settings.enabled) {
    return { success: false, error: 'MAIA SDR is currently disabled' };
  }
  
  // Check active hours
  const withinHours = await isWithinActiveHours();
  if (!withinHours) {
    console.log('[MAIA BG] Outside active hours, skipping');
    return { success: false, error: 'Outside active hours' };
  }
  
  // Send to MAIA API
  return await sendToMAIA(data);
}

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[MAIA BG] Extension installed');
    // Set default settings
    chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: {
        enabled: true,
        draftMode: true,
        responseDelaySeconds: 3,
        activeHoursOnly: false,
      },
      [STORAGE_KEYS.API_URL]: DEFAULT_API_URL,
    });
  } else if (details.reason === 'update') {
    console.log('[MAIA BG] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Handle extension icon click when no popup is defined
 */
chrome.action.onClicked.addListener((tab) => {
  // This won't fire because we have a popup defined
  console.log('[MAIA BG] Extension icon clicked');
});

console.log('[MAIA BG] Background service worker started');
