import { TabHandler } from '../types';

export class ConversationTab implements TabHandler {
  private contentElement: HTMLElement | null = null;

  initialize(contentElement: HTMLElement): void {
    this.contentElement = contentElement;
    this.createComingSoonMessage();
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

  private createComingSoonMessage(): void {
    if (!this.contentElement) return;
    
    // Style the coming soon message
    this.contentElement.innerHTML = `
      <div class="coming-soon">
        <div class="coming-soon-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#aaa">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <h3>Conversation Feature Coming Soon</h3>
        <p>You'll be able to chat with the AI about the video content here.</p>
      </div>
    `;
    
    // Add styles for coming soon message
    const style = document.createElement('style');
    style.textContent = `
      .coming-soon {
        color: #777;
        text-align: center;
        padding: 40px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
      }
      
      .coming-soon-icon {
        margin-bottom: 15px;
        opacity: 0.6;
      }
      
      .coming-soon h3 {
        margin: 0 0 10px 0;
        color: #555;
      }
      
      .coming-soon p {
        margin: 0;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  getContent(): string | null {
    return null;
  }
}

export default new ConversationTab();
