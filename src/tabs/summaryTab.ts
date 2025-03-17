import { TabHandler } from '../types';
import { renderMarkdown, sanitizeHtml } from '../markdownRenderer';
import { markdownContent } from '../components/SummaryController';

export class SummaryTab implements TabHandler {
  private contentElement: HTMLElement | null = null;
  private content: string = '';
  private markdownContent = '';

  initialize(contentElement: HTMLElement): void {
    this.contentElement = contentElement;
    
    // Add proper styling for content container
    if (this.contentElement) {
      this.contentElement.style.boxSizing = 'border-box';
      this.contentElement.style.height = '100%';
      this.contentElement.style.paddingBottom = '20px'; // Add extra padding at the bottom
    }
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

  handleContent(content: string, append: boolean = false): void {
    if (!this.contentElement) return;

    if (append) {
      this.contentElement.textContent += content;
    } else {
      this.contentElement.textContent = content;
      this.markdownContent = content;
    }
    
    // Ensure content is fully visible
    this.ensureContentVisible();
  }

  async handleMarkdown(markdownText: string): Promise<void> {
    if (!this.contentElement) return;

    try {
      this.markdownContent = markdownText;
      // Render and sanitize markdown
      const html = await renderMarkdown(markdownText);
      const safeHtml = sanitizeHtml(html);
      
      // Update the content
      this.contentElement.innerHTML = safeHtml;
      
      // Ensure content is fully visible
      this.ensureContentVisible();
    } catch (error) {
      // Fallback to plain text if rendering fails
      this.contentElement.textContent = markdownText;
    }
  }

  copyContent(): string | null {
    // Get the current URL to use as the key
    const stateKey = window.location.href;
    
    // First try to get content from the markdownContent map
    const markdownText = markdownContent.get(stateKey);
    if (markdownText) {
      return markdownText;
    }
    
    // If not available in the map, use the locally stored content
    return this.content || null;
  }

  // Helper method to ensure content is fully visible
  private ensureContentVisible(): void {
    if (!this.contentElement) return;
    
    // Scroll to the bottom to ensure last line is visible
    setTimeout(() => {
      const containerParent = this.contentElement?.parentElement;
      if (containerParent) {
        // Ensure proper overflow settings for container
        containerParent.style.overflow = 'auto';
        
        // Make sure we can see the bottom content by adjusting scroll if needed
        if (this.contentElement && this.contentElement.scrollHeight > containerParent.clientHeight) {
          // Check if we need to scroll
          const lastParagraph = this.contentElement?.querySelector('p:last-child, li:last-child, h1:last-child, h2:last-child, h3:last-child');
          if (lastParagraph) {
            lastParagraph.scrollIntoView({ behavior: 'auto', block: 'nearest' });
          }
        }
      }
    }, 100);
  }

  getContent(): string {
    return this.markdownContent;
  }
}

export default new SummaryTab();
