// AI Chatbot for Abai Springs
class AbaiSpringsChatbot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.currentUser = null;
    this.conversationContext = {};
    this.init();
  }

  init() {
    console.log('🔧 Initializing Abai Springs Chatbot...');
    this.createChatbotUI();
    this.loadUserData();
    this.setupEventListeners();
    this.addWelcomeMessage();
    this.setupDelayedShow();
    console.log('✅ Chatbot initialized successfully');
  }

  createChatbotUI() {
    console.log('🎨 Creating chatbot UI...');
    const chatbotHTML = `
      <div id="chatbot-container" class="chatbot-container" style="display: none;">
        <!-- Chatbot Toggle Button -->
        <div id="chatbot-toggle" class="chatbot-toggle">
          <div class="water-ripple"></div>
          <div class="chatbot-toggle-icon">
            <i class="fas fa-comments"></i>
          </div>
          <div class="chatbot-toggle-badge" id="chatbot-badge" style="display: none;">0</div>
          <div class="always-here-badge">24/7</div>
        </div>

        <!-- Chatbot Window -->
        <div id="chatbot-window" class="chatbot-window" style="display: none;">
          <!-- Header -->
          <div class="chatbot-header">
            <div class="chatbot-header-info">
              <div class="chatbot-avatar">
                <i class="fas fa-tint"></i>
              </div>
              <div class="chatbot-title">
                <h4>Abai Springs Assistant</h4>
                <span class="chatbot-status">Online</span>
              </div>
            </div>
            <button id="chatbot-close" class="chatbot-close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Messages Container -->
          <div id="chatbot-messages" class="chatbot-messages">
            <!-- Messages will be dynamically added here -->
          </div>

          <!-- Input Area -->
          <div class="chatbot-input-area">
            <div class="chatbot-input-container">
              <input 
                type="text" 
                id="chatbot-input" 
                class="chatbot-input" 
                placeholder="Type your message..."
                autocomplete="off"
              >
              <button id="chatbot-send" class="chatbot-send">
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
            <div class="chatbot-quick-replies" id="chatbot-quick-replies">
              <!-- Quick reply buttons will be added here -->
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    console.log('✅ Chatbot UI created and added to DOM');
    
    // Verify the chatbot toggle button exists
    const toggleButton = document.getElementById('chatbot-toggle');
    if (toggleButton) {
      console.log('✅ Chatbot toggle button found:', toggleButton);
    } else {
      console.error('❌ Chatbot toggle button not found!');
    }
  }

  loadUserData() {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        this.currentUser = JSON.parse(user);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }

  setupEventListeners() {
    // Toggle chatbot
    const toggleButton = document.getElementById('chatbot-toggle');
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.toggleChatbot();
      });
    }

    // Close chatbot
    const closeButton = document.getElementById('chatbot-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeChatbot();
      });
    }

    // Send message
    const sendButton = document.getElementById('chatbot-send');
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        this.sendMessage();
      });
    }

    // Enter key to send message
    const inputField = document.getElementById('chatbot-input');
    if (inputField) {
      inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage();
        }
      });
    }

    // Track user interactions to show chatbot
    this.trackUserInteractions();
  }

  addWelcomeMessage() {
    const welcomeMessage = {
      type: 'bot',
      content: 'Hello! I am your Abai Springs assistant. How can I help you today?',
      timestamp: new Date()
    };

    this.addMessage(welcomeMessage);
    this.showQuickReplies([
      'Order Water',
      'Check Stock',
      'Track Delivery',
      'Product Info',
      'Customer Support'
    ]);
  }

  toggleChatbot() {
    if (this.isOpen) {
      this.closeChatbot();
    } else {
      this.openChatbot();
    }
  }

  openChatbot() {
    const window = document.getElementById('chatbot-window');
    if (window) {
      window.style.display = 'flex';
      this.isOpen = true;
      this.scrollToBottom();
    }
  }

  closeChatbot() {
    const window = document.getElementById('chatbot-window');
    if (window) {
      window.style.display = 'none';
      this.isOpen = false;
    }
  }

  sendMessage() {
    const input = document.getElementById('chatbot-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Add user message
    this.addMessage({
      type: 'user',
      content: message,
      timestamp: new Date()
    });

    // Clear input
    input.value = '';

    // Process message
    this.processMessage(message);
  }

  addMessage(message) {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  renderMessage(message) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `chatbot-message ${message.type}-message`;
    
    messageElement.innerHTML = `
      <div class="chatbot-message-content">
        <div class="chatbot-message-text">${this.formatMessage(message.content)}</div>
        <div class="chatbot-message-time">${this.formatTime(message.timestamp)}</div>
      </div>
    `;
    
    messagesContainer.appendChild(messageElement);
  }

  formatMessage(content) {
    return content.replace(/\n/g, '<br>');
  }

  formatTime(timestamp) {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  showQuickReplies(replies) {
    const quickRepliesContainer = document.getElementById('chatbot-quick-replies');
    if (!quickRepliesContainer) return;

    quickRepliesContainer.innerHTML = '';
    
    replies.forEach(reply => {
      const button = document.createElement('button');
      button.className = 'chatbot-quick-reply';
      button.textContent = reply;
      button.addEventListener('click', () => {
        this.handleQuickReply(reply);
      });
      quickRepliesContainer.appendChild(button);
    });
  }

  handleQuickReply(reply) {
    this.addMessage({
      type: 'user',
      content: reply,
      timestamp: new Date()
    });

    // Process the quick reply
    this.processMessage(reply);
  }

  async processMessage(message) {
    // Show typing indicator
    this.showTypingIndicator();

    // Simulate processing delay
    setTimeout(() => {
      this.hideTypingIndicator();
      
      // Generate response
      const response = this.generateResponse(message);
      
      this.addMessage({
        type: 'bot',
        content: response.content,
        timestamp: new Date()
      });

      if (response.quickReplies) {
        this.showQuickReplies(response.quickReplies);
      }
    }, 1000);
  }

  generateResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('order') || lowerMessage.includes('buy')) {
      return {
        content: 'Great! I can help you place an order. What type of water would you like to order?',
        quickReplies: ['Abai Springs', 'Sprinkle', 'Check Prices', 'Back to Menu']
      };
    }
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      return {
        content: 'Here are our current prices:\n\nAbai Springs:\n• 500ml - Ksh 50\n• 1L - Ksh 80\n• 5L - Ksh 300\n• 20L - Ksh 800\n\nSprinkle:\n• 500ml - Ksh 60\n• 1L - Ksh 90\n• 5L - Ksh 350\n• 10L - Ksh 600\n• 20L - Ksh 900',
        quickReplies: ['Place Order', 'Check Delivery Areas', 'Back to Menu']
      };
    }
    
    if (lowerMessage.includes('delivery') || lowerMessage.includes('track')) {
      return {
        content: 'I can help you track your delivery. Please provide your order number or phone number.',
        quickReplies: ['Enter Order Number', 'Enter Phone Number', 'Back to Menu']
      };
    }
    
    return {
      content: 'I understand you\'re asking about "' + message + '". How can I help you better? You can ask me about ordering, pricing, delivery, or customer support.',
      quickReplies: ['Order Water', 'Check Prices', 'Track Delivery', 'Customer Support']
    };
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const typingElement = document.createElement('div');
    typingElement.className = 'chatbot-message bot-message typing-indicator';
    typingElement.id = 'typing-indicator';
    
    typingElement.innerHTML = `
      <div class="chatbot-message-content">
        <div class="chatbot-message-text">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;
    
    messagesContainer.appendChild(typingElement);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  setupDelayedShow() {
    // Show chatbot after 10 seconds if no user interaction
    this.delayedShowTimeout = setTimeout(() => {
      this.showChatbot();
    }, 10000); // 10 seconds
  }

  trackUserInteractions() {
    // Track various user interactions
    const events = ['click', 'scroll', 'mousemove', 'keydown'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.onUserInteraction();
      }, { once: false, passive: true });
    });
  }

  onUserInteraction() {
    // Clear the delayed show timeout since user is interacting
    if (this.delayedShowTimeout) {
      clearTimeout(this.delayedShowTimeout);
      this.delayedShowTimeout = null;
    }
    
    // Show chatbot after 3 seconds of user interaction
    if (!this.hasShownAfterInteraction) {
      this.hasShownAfterInteraction = true;
      setTimeout(() => {
        this.showChatbot();
      }, 3000); // 3 seconds after first interaction
    }
  }

  showChatbot() {
    const container = document.getElementById('chatbot-container');
    if (container) {
      container.style.display = 'block';
      console.log('🤖 Chatbot is now visible to user');
    }
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing AbaiSpringsChatbot...');
  try {
    window.abaiChatbot = new AbaiSpringsChatbot();
    console.log('✅ Chatbot initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing chatbot:', error);
  }
});
