import { TabHandler } from '../types';
import { chatWithAI, ChatMessage, checkApiKeyAndInitClient } from '../services/openAIService';
import { renderMarkdown, sanitizeHtml, createMarkdownStyles } from '../markdownRenderer';

export class ConversationTab implements TabHandler {
  private contentElement: HTMLElement | null = null;
  private chatContainer: HTMLElement | null = null;
  private inputContainer: HTMLElement | null = null;
  private chatInput: HTMLTextAreaElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private clearButton: HTMLButtonElement | null = null;
  private transcript: string = '';
  private messages: ChatMessage[] = [];
  private isGenerating: boolean = false;
  private currentResponseElement: HTMLElement | null = null;

  initialize(contentElement: HTMLElement): void {
    this.contentElement = contentElement;
    this.setupChatInterface();
  }

  activate(): void {
    if (this.contentElement) {
      this.contentElement.style.display = 'block';
    }
  }

  deactivate(): void {
    if (this.contentElement) {
      this.contentElement.style.display = 'none';
    }
  }

  setTranscript(transcript: string): void {
    this.transcript = transcript;
  }

  private setupChatInterface(): void {
    if (!this.contentElement) return;

    // Style for chat interface
    const style = document.createElement('style');
    style.textContent = `
      .chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: visible; /* Changed from hidden to visible */
      }
      
      .messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        height: 0; /* Add explicit height: 0 to ensure flex-grow works properly */
        min-height: 0; /* Ensure the container can shrink */
      }

      .welcome-message {
        color: #777;
        text-align: center;
        padding: 40px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
      }
      
      .welcome-icon {
        margin-bottom: 15px;
        opacity: 0.6;
      }
      
      .welcome-message h3 {
        margin: 0 0 10px 0;
        color: #555;
      }
      
      .welcome-message p {
        margin: 0;
        font-size: 14px;
      }

      .message {
        padding: 10px 15px;
        border-radius: 18px;
        max-width: 85%;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
      }

      .message.user {
        align-self: flex-end;
        background-color: #0084ff;
        color: white;
      }

      .message.assistant {
        align-self: flex-start;
        background-color: #f1f0f0;
        color: #333;
      }

      /* Add markdown styles for the assistant messages */
      .message.assistant .markdown-body {
        color: #333;
        font-family: inherit;
      }

      .message.assistant p {
        margin: 0 0 10px 0;
      }
      
      .message.assistant p:last-child {
        margin-bottom: 0;
      }

      .typing-indicator {
        display: flex;
        padding: 10px 15px;
        background-color: #f1f0f0;
        border-radius: 18px;
        align-self: flex-start;
        width: 50px;
        justify-content: space-between;
      }

      .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #888;
        border-radius: 50%;
        animation: bounce 1.3s linear infinite;
      }

      .typing-indicator span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .typing-indicator span:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes bounce {
        0%, 60%, 100% {
          transform: translateY(0);
        }
        30% {
          transform: translateY(-5px);
        }
      }

      .input-container {
        display: flex;
        padding: 10px;
        background-color: #f5f5f5;
        border-top: 1px solid #ddd;
        position: relative;
      }

      .chat-input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 20px;
        padding: 10px 15px;
        font-size: 14px;
        resize: none;
        max-height: 120px;
        outline: none;
      }

      .send-button, .clear-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        color: #0084ff;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .send-button:hover, .clear-button:hover {
        background-color: rgba(0, 132, 255, 0.1);
      }

      .send-button:disabled {
        color: #ccc;
        cursor: not-allowed;
      }

      .send-button:disabled:hover {
        background-color: transparent;
      }
      
      .clear-button {
        position: absolute;
        top: -45px;
        right: 10px;
        background-color: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        color: #777;
      }
    `;
    
    // Add markdown styles
    const markdownStyle = document.createElement('style');
    markdownStyle.textContent = createMarkdownStyles();
    document.head.appendChild(markdownStyle);
    
    document.head.appendChild(style);

    // Create chat container
    this.contentElement.innerHTML = `
      <div class="chat-container">
        <div class="messages-container">
          <div class="welcome-message">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#aaa">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <h3>Chat about this video</h3>
            <p>Ask questions or discuss the content with AI.</p>
          </div>
        </div>
        <div class="input-container">
          <textarea class="chat-input" placeholder="Ask something about the video..."></textarea>
          <button class="send-button" title="Send">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
          <button class="clear-button" title="Clear chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Get references to elements
    this.chatContainer = this.contentElement.querySelector('.messages-container');
    this.inputContainer = this.contentElement.querySelector('.input-container');
    this.chatInput = this.contentElement.querySelector('.chat-input');
    this.sendButton = this.contentElement.querySelector('.send-button');
    this.clearButton = this.contentElement.querySelector('.clear-button');

    // Add event listeners
    this.sendButton?.addEventListener('click', () => this.sendMessage());
    this.clearButton?.addEventListener('click', () => this.clearChat());

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.isGenerating) {
          this.sendMessage();
        }
      }

      // Auto resize the textarea
      setTimeout(() => {
        if (this.chatInput) {
          this.chatInput.style.height = 'auto';
          this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 120)}px`;
        }
      }, 0);
    });
  }

  private sendMessage(): void {
    if (!this.chatInput || !this.chatContainer || !this.sendButton) return;

    const userMessage = this.chatInput.value.trim();
    if (!userMessage || this.isGenerating) return;

    // Remove welcome message if present
    const welcomeMessage = this.chatContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    // Add user message
    this.addMessage('user', userMessage);

    // Clear input and reset height
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Store message
    this.messages.push({ role: 'user', content: userMessage });

    // Show typing indicator
    this.showTypingIndicator();

    // Disable input during generation
    this.setGeneratingState(true);

    // Check API key and generate response
    this.generateResponse();
  }

  private async generateResponse(): Promise<void> {
    if (!this.transcript) {
      this.addMessage('assistant', "I don't have access to the video transcript yet. Please try again after the video has loaded completely.");
      this.setGeneratingState(false);
      return;
    }

    try {
      // Create a new message element for the assistant's response
      const responseElement = document.createElement('div');
      responseElement.className = 'message assistant';
      this.currentResponseElement = responseElement;

      // Remove typing indicator and add the response element
      const typingIndicator = this.chatContainer?.querySelector('.typing-indicator');
      if (typingIndicator) {
        typingIndicator.remove();
      }
      this.chatContainer?.appendChild(responseElement);

      // Scroll to bottom
      this.scrollToBottom();

      // Initialize response variable
      let responseText = '';

      // Send request to background script instead of calling API directly
      chrome.runtime.sendMessage({
        action: 'chatWithAI',
        transcript: this.transcript,
        messages: this.messages
      });

      // Set up message listener for responses
      this.setupMessageListener();
    } catch (error) {
      console.error('Error generating AI response:', error);
      this.addMessage('assistant', 'An unexpected error occurred. Please try again later.');
      this.setGeneratingState(false);
    }
  }

  private setupMessageListener(): void {
    // Create a one-time message listener for this chat session
    const messageHandler = (message: any) => {
      if (message.action === 'chatChunk') {
        // Handle incoming chunks
        if (this.currentResponseElement) {
          const currentText = this.currentResponseElement.getAttribute('data-raw-text') || '';
          const newText = currentText + message.content;
          
          // Store the raw text content as a data attribute
          this.currentResponseElement.setAttribute('data-raw-text', newText);
          
          // Then render with markdown asynchronously
          this.renderAssistantMessage(this.currentResponseElement, newText);
          
          this.scrollToBottom();
        }
      }
      else if (message.action === 'chatComplete') {
        // Handle completion
        if (this.currentResponseElement) {
          // Get the raw text content from the data attribute
          const content = this.currentResponseElement.getAttribute('data-raw-text') || '';
          
          // Add the assistant's response to the message history
          this.messages.push({ role: 'assistant', content });
        }
        this.setGeneratingState(false);
        this.currentResponseElement = null;
        // Remove this listener when done
        chrome.runtime.onMessage.removeListener(messageHandler);
      }
      else if (message.action === 'chatError') {
        // Handle errors
        this.addMessage('assistant', `Error: ${message.error}`);
        if (message.needsApiKey) {
          this.addMessage('assistant', 'Please add your OpenAI API key in the extension settings.');
        }
        this.setGeneratingState(false);
        // Remove this listener when done
        chrome.runtime.onMessage.removeListener(messageHandler);
      }
    };

    // Add the message listener
    chrome.runtime.onMessage.addListener(messageHandler);
  }

  // Helper to extract text from HTML (for storing in message history)
  private getTextFromHTML(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || '';
  }

  private addMessage(role: 'user' | 'assistant', content: string): void {
    if (!this.chatContainer) return;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;

    if (role === 'assistant') {
      // Store the raw text content as a data attribute
      messageEl.setAttribute('data-raw-text', content);
      
      // Create a container for the markdown content
      const markdownContainer = document.createElement('div');
      markdownContainer.className = 'markdown-body';
      messageEl.appendChild(markdownContainer);
      
      // Render the markdown asynchronously
      this.renderAssistantMessage(messageEl, content);
    } else {
      messageEl.textContent = content;
    }

    this.chatContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  private async renderAssistantMessage(element: HTMLElement, content: string): Promise<void> {
    try {
      const rendered = await this.formatMarkdown(content);
      
      // Find the markdown container or create one if it doesn't exist
      let markdownContainer = element.querySelector('.markdown-body');
      if (!markdownContainer) {
        markdownContainer = document.createElement('div');
        markdownContainer.className = 'markdown-body';
        element.appendChild(markdownContainer);
      }
      
      // Set the rendered content
      markdownContainer.innerHTML = rendered;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      element.textContent = content;
    }
  }

  private async formatMarkdown(text: string): Promise<string> {
    // Use the proper markdown renderer
    const rendered = await renderMarkdown(text);
    return sanitizeHtml(rendered);
  }

  private showTypingIndicator(): void {
    if (!this.chatContainer) return;

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';

    this.chatContainer.appendChild(typingIndicator);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  private setGeneratingState(isGenerating: boolean): void {
    this.isGenerating = isGenerating;
    if (this.sendButton) {
      this.sendButton.disabled = isGenerating;
    }
  }

  private clearChat(): void {
    if (!this.chatContainer || !this.chatInput) return;

    // Clear messages array
    this.messages = [];

    // Clear chat container and add welcome message
    this.chatContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#aaa">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <h3>Chat about this video</h3>
        <p>Ask questions or discuss the content with AI.</p>
      </div>
    `;

    // Clear input and reset height
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
  }

  getContent(): string | null {
    return null;
  }

  handleContent(content: string): void {
    this.handleTranscriptLoaded(content);
  }

  handleTranscriptLoaded(transcript: string): void {
    // For the conversation tab, we'll need the transcript to answer questions
    this.transcript = transcript;
  }

  copyContent(): string | null {
    if (this.messages.length === 0) return null;

    // Format chat for copying
    return this.messages.map(msg => {
      const role = msg.role === 'user' ? 'You' : 'AI';
      // Preserve line breaks in the content
      return `${role}:\n${msg.content}`;
    }).join('\n\n');
  }
}

export default new ConversationTab();
