/**
 * LinkedIn DOM selectors and helpers
 * 
 * Note: LinkedIn's DOM structure changes frequently.
 * These selectors may need to be updated periodically.
 */

// Message-related selectors
export const SELECTORS = {
  // Messaging page
  messagingContainer: '[class*="msg-overlay-list-bubble"]',
  conversationList: '[class*="msg-conversations-container"]',
  
  // Active conversation
  conversationPane: '[class*="msg-convo-wrapper"]',
  conversationHeader: '[class*="msg-thread__link-to-profile"]',
  
  // Messages in thread
  messageList: '[class*="msg-s-message-list"]',
  messageItem: '[class*="msg-s-message-list__event"]',
  messageBody: '[class*="msg-s-event-listitem__body"]',
  messageSender: '[class*="msg-s-message-group__name"]',
  messageTimestamp: '[class*="msg-s-message-list__time-heading"]',
  
  // Message composition
  messageInput: '[class*="msg-form__contenteditable"]',
  messageInputAlternate: '[contenteditable="true"][role="textbox"]',
  sendButton: '[class*="msg-form__send-button"]',
  sendButtonAlternate: 'button[type="submit"][class*="msg-form"]',
  
  // Profile info from conversation
  profileLink: '[class*="msg-thread__link-to-profile"]',
  profileName: '[class*="msg-s-message-group__name"]',
  profileTitle: '[class*="msg-s-message-group__title"]',
  
  // Presence indicators
  typingIndicator: '[class*="msg-s-typing-indicator"]',
  newMessageIndicator: '[class*="msg-overlay-list-bubble__unread-count"]',
};

/**
 * Get the message input element
 */
export function getMessageInput() {
  return (
    document.querySelector(SELECTORS.messageInput) ||
    document.querySelector(SELECTORS.messageInputAlternate)
  );
}

/**
 * Get the send button
 */
export function getSendButton() {
  return (
    document.querySelector(SELECTORS.sendButton) ||
    document.querySelector(SELECTORS.sendButtonAlternate)
  );
}

/**
 * Get all messages in the current thread
 */
export function getMessages() {
  const messageElements = document.querySelectorAll(SELECTORS.messageItem);
  const messages = [];
  
  messageElements.forEach((el, index) => {
    const bodyEl = el.querySelector(SELECTORS.messageBody);
    const senderEl = el.querySelector(SELECTORS.messageSender);
    
    if (bodyEl) {
      const text = bodyEl.textContent?.trim();
      const sender = senderEl?.textContent?.trim();
      const isOutbound = el.classList.toString().includes('outbound');
      
      if (text) {
        messages.push({
          id: `msg-${index}`,
          text,
          sender,
          isFromMe: isOutbound,
          element: el,
        });
      }
    }
  });
  
  return messages;
}

/**
 * Get the latest message in the thread
 */
export function getLatestMessage() {
  const messages = getMessages();
  return messages[messages.length - 1];
}

/**
 * Get conversation context (profile info, thread ID)
 */
export function getConversationContext() {
  const profileLink = document.querySelector(SELECTORS.profileLink);
  const profileUrl = profileLink?.getAttribute('href');
  
  // Extract thread ID from URL
  const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/]+)/);
  const threadId = urlMatch ? urlMatch[1] : null;
  
  // Get profile info from the thread
  const nameEl = document.querySelector(SELECTORS.profileName);
  const titleEl = document.querySelector(SELECTORS.profileTitle);
  
  return {
    threadId,
    profileUrl: profileUrl ? `https://www.linkedin.com${profileUrl}` : null,
    senderName: nameEl?.textContent?.trim(),
    senderTitle: titleEl?.textContent?.trim(),
    conversationUrl: window.location.href,
  };
}

/**
 * Set text in the message input
 */
export function setMessageInputText(text) {
  const input = getMessageInput();
  if (!input) {
    console.error('[MAIA] Message input not found');
    return false;
  }
  
  // Clear existing content
  input.innerHTML = '';
  
  // Set new content
  input.textContent = text;
  input.innerText = text;
  
  // Trigger input events so LinkedIn recognizes the change
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  input.dispatchEvent(inputEvent);
  
  // Also trigger focus and keyup events
  input.focus();
  const keyupEvent = new KeyboardEvent('keyup', { bubbles: true });
  input.dispatchEvent(keyupEvent);
  
  return true;
}

/**
 * Click the send button
 */
export function clickSendButton() {
  const sendButton = getSendButton();
  if (!sendButton) {
    console.error('[MAIA] Send button not found');
    return false;
  }
  
  // Check if button is disabled
  if (sendButton.disabled) {
    console.warn('[MAIA] Send button is disabled');
    return false;
  }
  
  sendButton.click();
  return true;
}

/**
 * Check if we're on a messaging page
 */
export function isMessagingPage() {
  return window.location.href.includes('/messaging/');
}

/**
 * Check if we're in an active conversation
 */
export function isInConversation() {
  return window.location.href.includes('/messaging/thread/');
}

/**
 * Wait for an element to appear in the DOM
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

/**
 * Parse profile URL to extract username
 */
export function parseProfileUrl(url) {
  if (!url) return null;
  const match = url.match(/\/in\/([^/]+)/);
  return match ? match[1] : null;
}
