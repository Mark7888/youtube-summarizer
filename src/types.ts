// Type definitions for YouTube Summarizer

// Tab types for the overlay
export type TabType = 'summary' | 'transcript' | 'conversation';

// Tab interface for tab handlers
export interface TabHandler {
  initialize: (container: HTMLElement) => void;
  activate: () => void;
  deactivate: () => void;
  handleContent: (content: string) => void;
  copyContent: () => string | null; // New method to get copyable content
}
