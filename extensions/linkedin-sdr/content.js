/**
 * MAIA LinkedIn SDR - Content Script
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

class MAIALinkedInSDR {
  constructor() {
    this.lastMessageId = null;
    this.observer = null;
    this.isProcessing = false;
    this.isProcessingUnread = false;
    this.conversationContext = null;
    this.enabled = true;
    this.settings = {};
    this.processedConversations = new Set();
    
    this.init();
  }

  async init() {
    console.log('[MAIA SDR] Initializing...');
    
    // Load settings
    await this.loadSettings();
    
    // Wait for the messaging page to fully load
    await this.waitForMessagingUI();
    
    // Start monitoring for new messages
    this.startMonitoring();
    
    // Listen for messages from background worker
    this.setupMessageListener();
    
    // Add status indicator
    this.addStatusIndicator();
    
    // Add "Process Unread" button
    this.addProcessUnreadButton();
    
    console.log('[MAIA SDR] Initialized successfully');
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      this.settings = response.settings || {};
      this.enabled = this.settings.enabled !== false;
    } catch (error) {
      console.warn('[MAIA SDR] Could not load settings:', error);
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
      console.error('[MAIA SDR] Message list not found');
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

    console.log('[MAIA SDR] Message monitoring started');
  }

  handlePotentialNewMessage() {
    const latestMessage = this.getLatestMessage();
    
    if (!latestMessage) return;
    if (latestMessage.id === this.lastMessageId) return;
    if (latestMessage.isFromMe) {
      this.lastMessageId = latestMessage.id;
      return;
    }

    // New incoming message detected
    this.lastMessageId = latestMessage.id;
    console.log('[MAIA SDR] New message detected:', latestMessage.text.substring(0, 50) + '...');
    
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

    return {
      id: `${Date.now()}-${messageElements.length}`,
      text,
      isFromMe: isOutbound,
      element: lastEl,
    };
  }

  async processNewMessage(message) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.updateStatusIndicator('processing', 'AI is thinking...');

    try {
      // Get conversation context
      const context = this.getConversationContext();
      
      // Send to background worker
      const response = await chrome.runtime.sendMessage({
        type: 'NEW_MESSAGE',
        data: {
          message: message.text,
          conversationContext: context,
          allMessages: this.getAllMessages(),
        },
      });

      if (response.success && response.response) {
        await this.handleAIResponse(response.response);
      } else if (response.error) {
        console.error('[MAIA SDR] AI processing error:', response.error);
        this.updateStatusIndicator('error', 'Error: ' + response.error);
      }
    } catch (error) {
      console.error('[MAIA SDR] Error processing message:', error);
      this.updateStatusIndicator('error', 'Failed to process message');
    } finally {
      this.isProcessing = false;
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
    const draftMode = this.settings.draftMode !== false; // Default to draft mode
    
    if (draftMode) {
      // Inject response but don't send
      this.injectResponse(responseText);
      this.updateStatusIndicator('success', 'Draft ready - review before sending');
    } else {
      // Auto-send after delay
      const delay = (this.settings.responseDelaySeconds || 3) * 1000;
      this.updateStatusIndicator('processing', `Sending in ${delay/1000}s...`);
      
      await this.sleep(delay);
      
      this.injectResponse(responseText);
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

  injectResponse(text) {
    const input = document.querySelector(SELECTORS.messageInput) ||
                  document.querySelector(SELECTORS.messageInputAlt);
    
    if (!input) {
      console.error('[MAIA SDR] Message input not found');
      return false;
    }

    // Clear and set content
    input.innerHTML = '';
    input.textContent = text;
    input.innerText = text;

    // Trigger events
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    input.dispatchEvent(inputEvent);
    input.focus();

    console.log('[MAIA SDR] Response injected');
    return true;
  }

  clickSendButton() {
    const sendButton = document.querySelector(SELECTORS.sendButton);
    if (!sendButton || sendButton.disabled) {
      console.error('[MAIA SDR] Send button not found or disabled');
      return false;
    }

    sendButton.click();
    console.log('[MAIA SDR] Send button clicked');
    return true;
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'INJECT_RESPONSE') {
        this.injectResponse(message.response);
        sendResponse({ success: true });
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
    const existing = document.querySelector('.maia-sdr-status');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'maia-sdr-status';
    indicator.innerHTML = `
      <div class="maia-sdr-status-dot"></div>
      <span class="maia-sdr-status-text">MAIA SDR Active</span>
    `;

    document.body.appendChild(indicator);
    this.statusIndicator = indicator;
  }

  updateStatusIndicator(status, message) {
    if (!this.statusIndicator) return;

    this.statusIndicator.className = `maia-sdr-status ${status}`;
    const textEl = this.statusIndicator.querySelector('.maia-sdr-status-text');
    
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
        textEl.textContent = 'MAIA SDR Paused';
        break;
      default:
        textEl.textContent = 'MAIA SDR Active';
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
    
    console.log(`[MAIA SDR] Found ${conversations.length} unread conversations`);
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
      console.log('[MAIA SDR] Already processing unread messages');
      return;
    }

    this.isProcessingUnread = true;
    const unreadConversations = this.getUnreadConversations();
    
    if (unreadConversations.length === 0) {
      this.updateStatusIndicator('success', 'No unread messages found');
      setTimeout(() => this.updateStatusIndicator('idle'), 3000);
      this.isProcessingUnread = false;
      return;
    }

    this.updateStatusIndicator('processing', `Processing ${unreadConversations.length} unread...`);

    let processed = 0;
    let errors = 0;

    for (const conversation of unreadConversations) {
      // Skip if already processed in this session
      if (conversation.threadId && this.processedConversations.has(conversation.threadId)) {
        continue;
      }

      try {
        this.updateStatusIndicator('processing', `Processing ${processed + 1}/${unreadConversations.length}: ${conversation.name}`);
        
        // Click to open the conversation
        conversation.linkElement.click();
        
        // Wait for conversation to load
        await this.sleep(1500);
        await this.waitForMessagingUI(5000);
        
        // Check if the last message is from them (not from us)
        const latestMessage = this.getLatestMessage();
        if (latestMessage && !latestMessage.isFromMe) {
          // Process this message
          await this.processNewMessage(latestMessage);
          
          // Wait for AI response to be drafted
          await this.sleep(2000);
        } else {
          console.log(`[MAIA SDR] Skipping ${conversation.name} - last message is from us`);
        }

        // Mark as processed
        if (conversation.threadId) {
          this.processedConversations.add(conversation.threadId);
        }
        
        processed++;
        
        // Small delay between conversations
        await this.sleep(1000);
        
      } catch (error) {
        console.error(`[MAIA SDR] Error processing conversation ${conversation.name}:`, error);
        errors++;
      }
    }

    this.isProcessingUnread = false;
    
    const message = errors > 0 
      ? `Done! ${processed} processed, ${errors} errors`
      : `Done! ${processed} conversations processed`;
    
    this.updateStatusIndicator('success', message);
    setTimeout(() => this.updateStatusIndicator('idle'), 5000);
  }

  /**
   * Add the "Process Unread" button to the UI
   */
  addProcessUnreadButton() {
    // Remove existing button if any
    const existing = document.querySelector('.maia-process-unread-btn');
    if (existing) existing.remove();

    const button = document.createElement('button');
    button.className = 'maia-process-unread-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      Process Unread
    `;
    button.title = 'Draft replies for all unread messages';
    
    button.addEventListener('click', () => {
      if (!this.isProcessingUnread) {
        this.processAllUnread();
      }
    });

    document.body.appendChild(button);
    this.processUnreadButton = button;
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }
    if (this.processUnreadButton) {
      this.processUnreadButton.remove();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MAIALinkedInSDR());
} else {
  new MAIALinkedInSDR();
}
