/**
 * LinkedIn SDR Extension - Content Script
 * 
 * This script runs on LinkedIn messaging pages and:
 * 1. Monitors for new incoming messages
 * 2. Sends messages to the background worker for AI processing
 * 3. Injects AI responses into the message input
 * 4. Handles user interactions (send, edit, cancel)
 */

// LinkedIn DOM selectors
const SELECTORS = {
  messageList: '[class*="msg-s-message-list"]',
  messageItem: '[class*="msg-s-message-list__event"]',
  messageBody: '[class*="msg-s-event-listitem__body"]',
  messageInput: '[class*="msg-form__contenteditable"]',
  messageInputAlt: '[contenteditable="true"][role="textbox"]',
  sendButton: '[class*="msg-form__send-button"]',
  conversationHeader: '[class*="msg-thread__link-to-profile"]',
  profileName: '[class*="msg-s-message-group__name"]',
  // Conversation list selectors
  conversationList: '[class*="msg-conversations-container__conversations-list"]',
  conversationItem: '[class*="msg-conversation-listitem"]',
  conversationLink: '[class*="msg-conversation-listitem__link"]',
  unreadIndicator: '[class*="msg-conversation-listitem__unread-count"]',
  unreadDot: '[class*="notification-badge"]',
};

// Debug mode - always on for development
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log('[LinkedIn SDR]', ...args);
}

function logError(...args) {
  console.error('[LinkedIn SDR ERROR]', ...args);
}

function logWarn(...args) {
  console.warn('[LinkedIn SDR WARN]', ...args);
}

class LinkedInSDRExtension {
  constructor() {
    this.lastProcessedMessageHash = null;
    this.lastProcessedThreadId = null;
    this.observer = null;
    this.isProcessing = false;
    this.isProcessingUnread = false;
    this.stopRequested = false;
    this.conversationContext = null;
    this.enabled = true;
    this.settings = {};
    this.processedMessages = new Set(); // Track processed message hashes
    this.processedConversations = new Set();
    
    log('Constructor called');
    this.init();
  }

  async init() {
    log('Initializing...');
    
    // Load settings
    await this.loadSettings();
    log('Settings loaded:', this.settings);
    
    // Wait for the messaging page to fully load
    await this.waitForMessagingUI();
    log('Messaging UI ready');
    
    // Start monitoring for new messages
    this.startMonitoring();
    
    // Listen for messages from background worker
    this.setupMessageListener();
    
    // Add status indicator and controls
    this.addStatusIndicator();
    this.addControlPanel();
    
    log('Initialized successfully');
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      this.settings = response.settings || {};
      this.enabled = this.settings.enabled !== false;
    } catch (error) {
      console.warn('[LinkedIn SDR] Could not load settings:', error);
    }
  }

  async waitForMessagingUI(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const messageList = document.querySelector(SELECTORS.messageList);
      if (messageList) {
        return messageList;
      }
      await this.sleep(500);
    }
    
    throw new Error('Messaging UI did not load in time');
  }

  startMonitoring() {
    const messageList = document.querySelector(SELECTORS.messageList);
    if (!messageList) {
      console.error('[LinkedIn SDR] Message list not found');
      return;
    }

    // Use MutationObserver to detect new messages
    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled || this.isProcessing) return;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          this.handlePotentialNewMessage();
        }
      }
    });

    this.observer.observe(messageList, {
      childList: true,
      subtree: true,
    });

    // Also check periodically for new messages
    setInterval(() => {
      if (this.enabled && !this.isProcessing) {
        this.handlePotentialNewMessage();
      }
    }, 2000);

    console.log('[LinkedIn SDR] Message monitoring started');
  }

  /**
   * Generate a hash for a message to track if we've processed it
   */
  hashMessage(text, threadId) {
    // Simple hash: combine thread ID + first 100 chars of message
    const content = `${threadId || 'unknown'}-${(text || '').substring(0, 100)}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  handlePotentialNewMessage() {
    if (this.isProcessing) {
      log('Already processing, skipping');
      return;
    }
    
    if (this.stopRequested) {
      log('Stop requested, skipping');
      return;
    }

    const currentThreadId = this.extractThreadId();
    const latestMessage = this.getLatestMessage();
    
    if (!latestMessage) {
      log('No latest message found');
      return;
    }
    
    if (!latestMessage.text) {
      log('Latest message has no text');
      return;
    }

    // Generate unique hash for this message
    const messageHash = this.hashMessage(latestMessage.text, currentThreadId);
    
    // Check if we've already processed this exact message
    if (this.processedMessages.has(messageHash)) {
      log('Message already processed, hash:', messageHash);
      return;
    }
    
    // Skip if from me
    if (latestMessage.isFromMe) {
      log('Latest message is from me, skipping');
      this.processedMessages.add(messageHash);
      return;
    }

    // Mark as processed BEFORE we start processing to prevent duplicates
    this.processedMessages.add(messageHash);
    
    log('New message detected:', {
      text: latestMessage.text.substring(0, 50) + '...',
      hash: messageHash,
      threadId: currentThreadId,
      isFromMe: latestMessage.isFromMe,
    });
    
    this.processNewMessage(latestMessage);
  }

  getLatestMessage() {
    const messageElements = document.querySelectorAll(SELECTORS.messageItem);
    if (messageElements.length === 0) return null;

    const lastEl = messageElements[messageElements.length - 1];
    const bodyEl = lastEl.querySelector(SELECTORS.messageBody);
    
    if (!bodyEl) return null;

    const text = bodyEl.textContent?.trim();
    const isOutbound = lastEl.classList.toString().includes('outbound');

    log('getLatestMessage:', {
      text: text?.substring(0, 30),
      isOutbound,
      classList: lastEl.classList.toString().substring(0, 100),
    });

    return {
      text,
      isFromMe: isOutbound,
      element: lastEl,
    };
  }

  async processNewMessage(message) {
    if (this.isProcessing) {
      log('processNewMessage: Already processing, returning');
      return;
    }
    
    if (this.stopRequested) {
      log('processNewMessage: Stop requested, returning');
      return;
    }
    
    this.isProcessing = true;
    this.updateStatusIndicator('processing', 'AI is thinking...');

    try {
      // Get conversation context
      const context = this.getConversationContext();
      const allMessages = this.getAllMessages();
      
      log('Processing message:', {
        messageText: message.text?.substring(0, 50),
        context,
        messageCount: allMessages.length,
      });
      
      // Send to background worker
      const response = await chrome.runtime.sendMessage({
        type: 'NEW_MESSAGE',
        data: {
          message: message.text,
          conversationContext: context,
          allMessages: allMessages,
        },
      });

      log('Background response:', {
        success: response?.success,
        hasResponse: !!response?.response,
        error: response?.error,
        responsePreview: response?.response?.substring(0, 50),
      });

      if (this.stopRequested) {
        log('Stop requested after API call, not injecting response');
        return;
      }

      if (response.success && response.response) {
        await this.handleAIResponse(response.response);
      } else if (response.error) {
        logError('❌ AI processing error:', response.error);
        if (response.debugInfo) {
          log('Debug info:', JSON.stringify(response.debugInfo));
        }
        if (response.statusCode) {
          log('Status code:', response.statusCode);
        }
        if (response.errorDetails) {
          log('Error details:', response.errorDetails.substring(0, 500));
        }
        this.updateStatusIndicator('error', 'Error: ' + response.error);
      } else {
        logWarn('Unknown response format:', JSON.stringify(response).substring(0, 200));
        this.updateStatusIndicator('error', 'Unknown response');
      }
    } catch (error) {
      logError('Error processing message:', error);
      this.updateStatusIndicator('error', 'Failed to process message');
    } finally {
      this.isProcessing = false;
      log('Processing complete, isProcessing set to false');
    }
  }

  getConversationContext() {
    const profileLink = document.querySelector(SELECTORS.conversationHeader);
    const profileUrl = profileLink?.getAttribute('href');
    const nameEl = document.querySelector(SELECTORS.profileName);

    return {
      profileUrl: profileUrl ? `https://www.linkedin.com${profileUrl}` : null,
      senderName: nameEl?.textContent?.trim(),
      conversationUrl: window.location.href,
      threadId: this.extractThreadId(),
    };
  }

  extractThreadId() {
    const match = window.location.href.match(/\/messaging\/thread\/([^/]+)/);
    return match ? match[1] : null;
  }

  getAllMessages() {
    const messageElements = document.querySelectorAll(SELECTORS.messageItem);
    const messages = [];

    messageElements.forEach((el, index) => {
      const bodyEl = el.querySelector(SELECTORS.messageBody);
      if (bodyEl) {
        const text = bodyEl.textContent?.trim();
        const isOutbound = el.classList.toString().includes('outbound');
        if (text) {
          messages.push({
            role: isOutbound ? 'assistant' : 'user',
            content: text,
          });
        }
      }
    });

    return messages;
  }

  async handleAIResponse(responseText) {
    log('handleAIResponse called with:', responseText?.substring(0, 100));
    
    if (!responseText || responseText.trim() === '') {
      logWarn('Empty response received, skipping injection');
      this.updateStatusIndicator('error', 'Empty response');
      return;
    }
    
    // Clean the response - remove any potential prompt leakage
    let cleanedResponse = responseText.trim();
    
    // Remove common AI response prefixes that might leak
    const prefixesToRemove = [
      /^Here's a draft:?\s*/i,
      /^Here is a draft:?\s*/i,
      /^Draft:?\s*/i,
      /^Response:?\s*/i,
      /^Message:?\s*/i,
      /^Here's my response:?\s*/i,
      /^I would respond:?\s*/i,
    ];
    
    for (const prefix of prefixesToRemove) {
      cleanedResponse = cleanedResponse.replace(prefix, '');
    }
    
    log('Cleaned response:', cleanedResponse.substring(0, 100));
    
    const draftMode = this.settings.draftMode !== false; // Default to draft mode
    
    if (draftMode) {
      // Inject response but don't send
      await this.injectResponse(cleanedResponse);
      this.updateStatusIndicator('success', 'Draft ready - review before sending');
    } else {
      if (this.stopRequested) {
        log('Stop requested, not auto-sending');
        return;
      }
      
      // Auto-send after delay
      const delay = (this.settings.responseDelaySeconds || 3) * 1000;
      this.updateStatusIndicator('processing', `Sending in ${delay/1000}s...`);
      
      await this.sleep(delay);
      
      if (this.stopRequested) {
        log('Stop requested during delay, not sending');
        return;
      }
      
      await this.injectResponse(cleanedResponse);
      await this.sleep(500);
      
      if (this.clickSendButton()) {
        this.updateStatusIndicator('success', 'Message sent!');
      } else {
        this.updateStatusIndicator('error', 'Failed to send');
      }
    }

    // Clear status after a delay
    setTimeout(() => {
      this.updateStatusIndicator('idle');
    }, 3000);
  }

  async injectResponse(text) {
    log('injectResponse called with:', text?.substring(0, 50));
    
    const input = document.querySelector(SELECTORS.messageInput) ||
                  document.querySelector(SELECTORS.messageInputAlt);
    
    if (!input) {
      logError('Message input not found');
      return false;
    }

    log('Found input element:', input.className);

    // Click on the input to ensure it's active
    input.click();
    await this.sleep(50);
    
    // Focus the input
    input.focus();
    await this.sleep(50);
    
    // Select all existing content and delete it
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    
    // Use execCommand to insert text - this simulates actual typing
    // and properly triggers LinkedIn's React state updates
    const success = document.execCommand('insertText', false, text);
    
    log('execCommand insertText result:', success);
    
    if (!success) {
      log('execCommand failed, trying paste approach');
      
      // Fallback: simulate paste
      input.innerHTML = '';
      
      // Try using clipboard API approach
      const p = document.createElement('p');
      p.textContent = text;
      input.appendChild(p);
      
      // Dispatch multiple events to trigger React
      ['input', 'change', 'keyup', 'keydown'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        input.dispatchEvent(event);
      });
      
      // Also try InputEvent specifically
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      });
      input.dispatchEvent(inputEvent);
    }
    
    // Ensure the input is focused at the end
    const selection = window.getSelection();
    if (selection && input.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false); // false = collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
    }

    log('Response injected successfully');
    return true;
  }

  clickSendButton() {
    const sendButton = document.querySelector(SELECTORS.sendButton);
    if (!sendButton || sendButton.disabled) {
      console.error('[LinkedIn SDR] Send button not found or disabled');
      return false;
    }

    sendButton.click();
    console.log('[LinkedIn SDR] Send button clicked');
    return true;
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'INJECT_RESPONSE') {
        this.injectResponse(message.response).then(() => sendResponse({ success: true }));
        return true; // Keep channel open for async
      } else if (message.type === 'TOGGLE_ENABLED') {
        this.enabled = message.enabled;
        this.updateStatusIndicator(this.enabled ? 'idle' : 'disabled');
        sendResponse({ success: true });
      } else if (message.type === 'UPDATE_SETTINGS') {
        this.settings = message.settings;
        sendResponse({ success: true });
      } else if (message.type === 'PROCESS_UNREAD') {
        this.processAllUnread().then(() => sendResponse({ success: true }));
        return true; // Keep channel open for async
      } else if (message.type === 'GET_UNREAD_COUNT') {
        const unread = this.getUnreadConversations();
        sendResponse({ count: unread.length });
      }
      return true;
    });
  }

  addStatusIndicator() {
    // Remove existing indicator if any
    const existing = document.querySelector('.linkedin-sdr-status');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'linkedin-sdr-status';
    indicator.innerHTML = `
      <div class="linkedin-sdr-status-dot"></div>
      <span class="linkedin-sdr-status-text">LinkedIn SDR Active</span>
    `;

    document.body.appendChild(indicator);
    this.statusIndicator = indicator;
  }

  updateStatusIndicator(status, message) {
    if (!this.statusIndicator) return;

    this.statusIndicator.className = `linkedin-sdr-status ${status}`;
    const textEl = this.statusIndicator.querySelector('.linkedin-sdr-status-text');
    
    switch (status) {
      case 'processing':
        textEl.textContent = message || 'Processing...';
        break;
      case 'success':
        textEl.textContent = message || 'Done!';
        break;
      case 'error':
        textEl.textContent = message || 'Error';
        break;
      case 'disabled':
        textEl.textContent = 'LinkedIn SDR Paused';
        break;
      default:
        textEl.textContent = 'LinkedIn SDR Active';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Unread Message Processing
  // ============================================================================

  /**
   * Get all unread conversations from the sidebar
   */
  getUnreadConversations() {
    const conversations = [];
    const conversationItems = document.querySelectorAll(SELECTORS.conversationItem);
    
    conversationItems.forEach((item) => {
      // Check for unread indicators (badge count or dot)
      const unreadBadge = item.querySelector(SELECTORS.unreadIndicator);
      const unreadDot = item.querySelector(SELECTORS.unreadDot);
      const hasUnread = unreadBadge || unreadDot || 
                        item.classList.toString().includes('unread') ||
                        item.querySelector('[class*="unread"]');
      
      if (hasUnread) {
        const link = item.querySelector(SELECTORS.conversationLink) || item.querySelector('a');
        const nameEl = item.querySelector('[class*="participant__name"]') || 
                       item.querySelector('[class*="msg-conversation-card__participant-names"]');
        
        if (link) {
          const href = link.getAttribute('href');
          const threadId = href ? this.extractThreadIdFromHref(href) : null;
          
          conversations.push({
            element: item,
            linkElement: link,
            name: nameEl?.textContent?.trim() || 'Unknown',
            threadId,
            href,
          });
        }
      }
    });
    
    console.log(`[LinkedIn SDR] Found ${conversations.length} unread conversations`);
    return conversations;
  }

  extractThreadIdFromHref(href) {
    const match = href.match(/\/messaging\/thread\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Process all unread conversations
   */
  async processAllUnread() {
    if (this.isProcessingUnread) {
      log('Already processing unread messages');
      return;
    }

    this.isProcessingUnread = true;
    this.stopRequested = false;
    
    const unreadConversations = this.getUnreadConversations();
    
    if (unreadConversations.length === 0) {
      this.updateStatusIndicator('success', 'No unread messages found');
      setTimeout(() => this.updateStatusIndicator('idle'), 3000);
      this.isProcessingUnread = false;
      this.showStopButton(false);
      return;
    }

    log(`Found ${unreadConversations.length} unread conversations`);
    this.updateStatusIndicator('processing', `Processing ${unreadConversations.length} unread...`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const conversation of unreadConversations) {
      // Check if stop was requested
      if (this.stopRequested) {
        log('Stop requested, breaking out of loop');
        break;
      }
      
      // Skip if already processed in this session
      if (conversation.threadId && this.processedConversations.has(conversation.threadId)) {
        log(`Skipping already processed conversation: ${conversation.name}`);
        skipped++;
        continue;
      }

      try {
        this.updateStatusIndicator('processing', `Processing ${processed + 1}/${unreadConversations.length}: ${conversation.name}`);
        log(`Opening conversation: ${conversation.name}`);
        
        // Click to open the conversation
        conversation.linkElement.click();
        
        // Wait for conversation to load
        await this.sleep(1500);
        await this.waitForMessagingUI(5000);
        
        if (this.stopRequested) break;
        
        // Check if the last message is from them (not from us)
        const latestMessage = this.getLatestMessage();
        log(`Latest message in ${conversation.name}:`, {
          hasMessage: !!latestMessage,
          isFromMe: latestMessage?.isFromMe,
          text: latestMessage?.text?.substring(0, 30),
        });
        
        if (latestMessage && !latestMessage.isFromMe && latestMessage.text) {
          // Process this message
          await this.processNewMessage(latestMessage);
          
          // Wait for AI response to be drafted
          await this.sleep(2000);
        } else {
          log(`Skipping ${conversation.name} - last message is from us or empty`);
          skipped++;
        }

        // Mark as processed
        if (conversation.threadId) {
          this.processedConversations.add(conversation.threadId);
        }
        
        processed++;
        
        // Small delay between conversations
        await this.sleep(1000);
        
      } catch (error) {
        logError(`Error processing conversation ${conversation.name}:`, error);
        errors++;
      }
    }

    this.isProcessingUnread = false;
    this.showStopButton(false);
    
    const message = this.stopRequested 
      ? `Stopped. ${processed} processed`
      : errors > 0 
        ? `Done! ${processed} processed, ${skipped} skipped, ${errors} errors`
        : `Done! ${processed} processed, ${skipped} skipped`;
    
    log(message);
    this.updateStatusIndicator(this.stopRequested ? 'idle' : 'success', message);
    setTimeout(() => this.updateStatusIndicator('idle'), 5000);
  }

  /**
   * Add control panel with stop button and mode controls
   */
  addControlPanel() {
    // Remove existing panel if any
    const existing = document.querySelector('.linkedin-control-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'linkedin-control-panel';
    panel.innerHTML = `
      <div class="linkedin-control-header">
        <span class="linkedin-control-title">LinkedIn SDR</span>
        <button class="linkedin-control-close" title="Minimize">−</button>
      </div>
      <div class="linkedin-control-body">
        <button class="linkedin-ctrl-btn linkedin-btn-unread" title="Process all unread conversations">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          Process Unread
        </button>
        <button class="linkedin-ctrl-btn linkedin-btn-current" title="Generate reply for current conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          This Chat
        </button>
        <button class="linkedin-ctrl-btn linkedin-btn-stop" title="Stop all processing" style="display: none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          </svg>
          STOP
        </button>
        <button class="linkedin-ctrl-btn linkedin-btn-clear" title="Clear processed message cache">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Reset
        </button>
      </div>
    `;

    document.body.appendChild(panel);
    this.controlPanel = panel;
    
    // Set up event listeners
    panel.querySelector('.linkedin-control-close').addEventListener('click', () => {
      panel.classList.toggle('minimized');
    });
    
    panel.querySelector('.linkedin-btn-unread').addEventListener('click', () => {
      if (!this.isProcessingUnread && !this.isProcessing) {
        this.stopRequested = false;
        this.showStopButton(true);
        this.processAllUnread();
      }
    });
    
    panel.querySelector('.linkedin-btn-current').addEventListener('click', () => {
      if (!this.isProcessing) {
        this.stopRequested = false;
        this.processCurrentConversation();
      }
    });
    
    panel.querySelector('.linkedin-btn-stop').addEventListener('click', () => {
      log('STOP button clicked');
      this.stopRequested = true;
      this.isProcessing = false;
      this.isProcessingUnread = false;
      this.showStopButton(false);
      this.updateStatusIndicator('idle', 'Stopped');
    });
    
    panel.querySelector('.linkedin-btn-clear').addEventListener('click', () => {
      this.processedMessages.clear();
      this.processedConversations.clear();
      log('Cleared processed message cache');
      this.updateStatusIndicator('success', 'Cache cleared');
      setTimeout(() => this.updateStatusIndicator('idle'), 2000);
    });
  }
  
  showStopButton(show) {
    const stopBtn = this.controlPanel?.querySelector('.linkedin-btn-stop');
    if (stopBtn) {
      stopBtn.style.display = show ? 'flex' : 'none';
    }
  }
  
  /**
   * Process just the current conversation
   */
  async processCurrentConversation() {
    if (this.isProcessing) {
      log('Already processing');
      return;
    }
    
    log('Processing current conversation');
    
    const latestMessage = this.getLatestMessage();
    if (!latestMessage) {
      this.updateStatusIndicator('error', 'No messages found');
      return;
    }
    
    if (latestMessage.isFromMe) {
      this.updateStatusIndicator('error', 'Last message is yours');
      setTimeout(() => this.updateStatusIndicator('idle'), 3000);
      return;
    }
    
    // Clear the hash for this message so we can reprocess it
    const threadId = this.extractThreadId();
    const messageHash = this.hashMessage(latestMessage.text, threadId);
    this.processedMessages.delete(messageHash);
    
    await this.processNewMessage(latestMessage);
  }

  destroy() {
    log('Destroying LinkedIn SDR instance');
    this.stopRequested = true;
    
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }
    if (this.controlPanel) {
      this.controlPanel.remove();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LinkedInSDRExtension());
} else {
  new LinkedInSDRExtension();
}
