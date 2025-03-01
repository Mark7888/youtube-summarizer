console.log('Background script running');

import { extractVideoId, fetchTranscript } from './services/youtubeTranscriptService';
import { 
  checkApiKeyAndInitClient, 
  generateSummary, 
  resetClient 
} from './services/openAIService';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'summarize') {
    console.log('Summarize request received for URL:', message.videoUrl);

    // Extract video ID from URL
    const videoId = extractVideoId(message.videoUrl);

    if (!videoId) {
      sendResponse({ success: false, error: 'Invalid YouTube URL' });
      return true;
    }

    // Use Promise handling with proper response
    handleSummarize(videoId, sendResponse)
      .catch(error => {
        sendResponse({
          success: false,
          error: 'An unexpected error occurred'
        });
      });
    
    return true; // Keep the message channel open for async responses
  }
  
  if (message.action === 'checkApiKey') {
    checkApiKeyAndInitClient()
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: 'Failed to check API key', 
          needsApiKey: true 
        });
      });
    
    return true; // Keep the message channel open for async responses
  }
  
  if (message.action === 'resetApiClient') {
    // Reset the client to force reinitialization with the new API key
    resetClient();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'generateSummary' && sender.tab?.id) {
    const tabId = sender.tab.id;
    
    // Important: Don't use await or Promise handling here
    // Just start the process and acknowledge receipt immediately
    getSummaryOpenAI(message.transcript, tabId);
    
    // Send immediate acknowledgment and close the message channel
    sendResponse({ success: true, message: 'Summary generation started' });
    return true;
  }
  
  return false; // No async response needed
});

// Handle summarizing process - now returns a Promise
async function handleSummarize(videoId: string, sendResponse: (response: any) => void): Promise<void> {
  try {
    // First, check if OpenAI client is initialized
    const initResult = await checkApiKeyAndInitClient();
    if (!initResult.success) {
      sendResponse({ 
        success: false, 
        error: initResult.error || 'No API key found',
        needsApiKey: true 
      });
      return;
    }

    // Fetch transcript
    const transcriptResult = await fetchTranscript(videoId);
    
    if (!transcriptResult.success) {
      sendResponse({ 
        success: false, 
        error: transcriptResult.error
      });
      return;
    }

    // Send successful response with transcript
    sendResponse({
      success: true,
      action: 'prepareSummary',
      transcript: transcriptResult.transcript
    });
    
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process video'
    });
  }
}

// Helper function to safely send messages to tabs without awaiting responses
function sendTabMessage(tabId: number, message: any): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if tab exists first to avoid errors with closed tabs
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        // Tab doesn't exist anymore
        resolve(); // Resolve silently, don't reject
        return;
      }
      
      // Tab exists, try to send message
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Don't reject on error, just log and continue
          console.log('Tab message error (tab may be closed):', chrome.runtime.lastError);
        }
        resolve(); // Always resolve, even on error
      });
    });
  });
}

// Summarize transcript using OpenAI - now using the service
async function getSummaryOpenAI(transcript: string, tabId: number): Promise<void> {
  await generateSummary(
    transcript,
    // OnChunk handler
    (content) => {
      sendTabMessage(tabId, {
        action: 'updateSummary',
        content: content
      }).catch(err => {
        // Continue processing - don't break the loop
      });
    },
    // OnComplete handler
    () => {
      sendTabMessage(tabId, { action: 'summaryComplete' })
        .catch(err => {
          // Error handling
        });
    },
    // OnError handler
    (error, needsApiKey) => {
      sendTabMessage(tabId, {
        action: 'summaryError',
        error: error,
        needsApiKey: needsApiKey
      });
    }
  );
}

// Add storage change listener to reset client when API key changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.openaiApiKey) {
    console.log('API key changed, resetting client');
    resetClient();
  }
});
