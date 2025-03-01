// Shared types for the extension

// Tab type definition
export type TabType = 'summary' | 'transcript' | 'conversation';

// Interface for tab handlers
export interface TabHandler {
  initialize: (contentElement: HTMLElement) => void;
  activate: () => void;
  deactivate: () => void;
  handleContent?: (content: string, append?: boolean) => void;
  handleMarkdown?: (markdown: string) => void;
  getContent?: () => string | null;
  handleTranscriptLoaded?: (transcript: string) => void;
}
