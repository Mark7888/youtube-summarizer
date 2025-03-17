import { TabHandler } from '../types';

export class TranscriptTab implements TabHandler {
  private contentElement: HTMLElement | null = null;
  private transcript: string = '';

  initialize(contentElement: HTMLElement): void {
    this.contentElement = contentElement;
    
    // Add proper styling for content container
    if (this.contentElement) {
      this.contentElement.style.boxSizing = 'border-box';
      this.contentElement.style.height = '100%';
      this.contentElement.style.paddingBottom = '20px'; // Add extra padding at the bottom
    }
    
    // Set initial content
    this.contentElement.innerHTML = '<div class="transcript-placeholder">Transcript will appear here once loaded</div>';
    this.styleTranscript();
  }

  activate(): void {
    if (this.contentElement) {
      this.contentElement.style.display = 'block';
      
      // If we already have a transcript, display it
      if (this.transcript) {
        this.displayTranscript();
      }
    }
  }

  deactivate(): void {
    if (this.contentElement) {
      this.contentElement.style.display = 'none';
    }
  }

  handleContent(content: string): void {
    // This method is required by the TabHandler interface
    // For transcript tab, we'll use this as an alternative way to set transcript content
    this.handleTranscriptLoaded(content);
  }

  handleTranscriptLoaded(transcript: string): void {
    this.transcript = transcript;
    
    // If this tab is active, display the transcript immediately
    if (this.contentElement && this.contentElement.style.display !== 'none') {
      this.displayTranscript();
    }
  }

  private displayTranscript(): void {
    if (!this.contentElement) return;
    
    if (this.transcript) {
      // Create a formatted transcript with paragraphs
      const formattedText = this.formatTranscript(this.transcript);
      this.contentElement.innerHTML = formattedText;
      
      // Ensure content is fully visible
      this.ensureContentVisible();
    } else {
      this.contentElement.innerHTML = '<div class="transcript-placeholder">No transcript available</div>';
    }
  }

  private formatTranscript(text: string): string {
    // Split into paragraphs every ~200 characters at a sentence boundary
    const sentences = text.replace(/([.?!])\s+/g, '$1\n').split('\n');
    let paragraphs = [];
    let currentParagraph = '';

    for (const sentence of sentences) {
      if (currentParagraph.length + sentence.length > 200) {
        paragraphs.push(currentParagraph);
        currentParagraph = sentence;
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + sentence;
      }
    }
    
    // Add the last paragraph if not empty
    if (currentParagraph) {
      paragraphs.push(currentParagraph);
    }

    // Join paragraphs with HTML paragraph tags
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
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
        
        // Make sure we can see all content by checking if scrollbar is needed
        if (this.contentElement && this.contentElement.scrollHeight > containerParent.clientHeight) {
          // We need to ensure the container shows scrollbar when content overflows
          this.contentElement.style.overflowY = 'auto';
          
          // Optional: scroll to a reasonable starting position, not too far down
          this.contentElement.scrollTop = 0;
        }
      }
    }, 100);
  }

  private styleTranscript(): void {
    // Add styles for transcript content
    const style = document.createElement('style');
    style.textContent = `
      .transcript-placeholder {
        color: #777;
        font-style: italic;
        text-align: center;
        padding: 20px;
      }
      
      .yt-summarizer-transcript p {
        margin-bottom: 1em;
        line-height: 1.5;
      }
      
      .yt-summarizer-transcript p:last-child {
        margin-bottom: 20px; /* Extra margin for the last paragraph */
      }
    `;
    document.head.appendChild(style);
  }

  getContent(): string {
    return this.transcript;
  }

  copyContent(): string {
    // Return the transcript in a clean format
    return this.transcript;
  }
}

export default new TranscriptTab();
