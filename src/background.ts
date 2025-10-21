console.log('Background script running');

import { extractVideoId, fetchTranscript } from './services/youtubeTranscriptService';
import { 
  checkApiKeyAndInitClient, 
  generateSummary, 
  resetClient,
  chatWithAI,
  ChatMessage,
  cancelGeneration
} from './services/openAIService';

// Track active generations
const activeGenerations = new Map<number, string>();

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
    handleSummarize(videoId, message.language, sendResponse)
      .catch(error => {
        sendResponse({
          success: false,
          error: 'An unexpected error occurred'
        });
      });
    
    return true; // Keep the message channel open for async responses
  }
  
  // Handle generation cancellation
  if (message.action === 'cancelGeneration') {
    // If tab ID is provided, cancel for that tab
    if (sender.tab?.id) {
      const tabId = sender.tab.id;
      if (activeGenerations.has(tabId)) {
        const generationId = activeGenerations.get(tabId);
        console.log(`Cancelling generation ${generationId} for tab ${tabId}`);
        
        // Mark this generation as cancelled to prevent further updates
        cancelGeneration(generationId);
        
        // Remove from active generations immediately
        activeGenerations.delete(tabId);
        
        // Send a cancellation confirmation message
        sendTabMessage(tabId, {
          action: 'generationCancelled'
        }).catch(err => {
          // Ignore errors here
        });
      }
    }
    
    sendResponse({ success: true, message: 'Cancellation requested' });
    return true;
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
    
    // Store the generation ID
    if (message.generationId) {
      activeGenerations.set(tabId, message.generationId);
    } else {
      // Create a new generation ID if none provided
      const generationId = Date.now().toString();
      activeGenerations.set(tabId, generationId);
      message.generationId = generationId;
    }
    
    // Important: Don't use await or Promise handling here
    // Just start the process and acknowledge receipt immediately
    getSummaryOpenAI(message.transcript, tabId, message.language, message.generationId);
    
    // Send immediate acknowledgment and close the message channel
    sendResponse({ success: true, message: 'Summary generation started' });
    return true;
  }
  
  if (message.action === 'chatWithAI' && sender.tab?.id) {
    const tabId = sender.tab.id;
    
    // Process chat request from conversation tab
    handleChatWithAI(message.transcript, message.messages, tabId);
    
    // Send immediate acknowledgment
    sendResponse({ success: true, message: 'Chat processing started' });
    return true;
  }
  
  return false; // No async response needed
});

// Handle summarizing process - now returns a Promise
async function handleSummarize(videoId: string, language: string | undefined, sendResponse: (response: any) => void): Promise<void> {
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

    // Fetch transcript with language parameter
    const transcriptResult = await fetchTranscript(videoId, language);
    
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
      transcript: transcriptResult.transcript,
      language: transcriptResult.language, // Return the language that was actually used
      vssId: transcriptResult.vssId // Return the track identifier
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
async function getSummaryOpenAI(transcript: string, tabId: number, language?: string, generationId?: string): Promise<void> {
  // Store this generation ID for potential cancellation
  if (generationId) {
    activeGenerations.set(tabId, generationId);
  }
  
  await generateSummary(
    transcript,
    // OnChunk handler
    (content) => {
      // Only send if this generation is still active
      if (!activeGenerations.has(tabId) || activeGenerations.get(tabId) === generationId) {
        sendTabMessage(tabId, {
          action: 'updateSummary',
          content: content,
          language: language,
          generationId: generationId
        }).catch(err => {
          // Continue processing - don't break the loop
        });
      }
    },
    // OnComplete handler
    () => {
      // Only send completion if this generation is still active
      if (!activeGenerations.has(tabId) || activeGenerations.get(tabId) === generationId) {
        sendTabMessage(tabId, { 
          action: 'summaryComplete',
          language: language,
          generationId: generationId
        })
        .catch(err => {
          // Error handling
        });
        
        // Remove from active generations upon completion
        if (activeGenerations.get(tabId) === generationId) {
          activeGenerations.delete(tabId);
        }
      }
    },
    // OnError handler
    (error, needsApiKey) => {
      sendTabMessage(tabId, {
        action: 'summaryError',
        error: error,
        needsApiKey: needsApiKey,
        generationId: generationId
      });
      
      // Remove from active generations on error
      if (activeGenerations.get(tabId) === generationId) {
        activeGenerations.delete(tabId);
      }
    },
    generationId // Pass generation ID to allow cancellation
  );
}

// Process chat requests with OpenAI
async function handleChatWithAI(transcript: string, messages: ChatMessage[], tabId: number): Promise<void> {
  try {
    // First check if API key is valid and initialized
    const initResult = await checkApiKeyAndInitClient();
    if (!initResult.success) {
      sendTabMessage(tabId, {
        action: 'chatResponse',
        success: false,
        error: initResult.error || 'Failed to initialize OpenAI client',
        needsApiKey: initResult.needsApiKey || false
      });
      return;
    }
    
    // Generate a unique ID for this chat generation
    const generationId = `chat_${Date.now()}`;
    
    // Process chat through the OpenAI service
    await chatWithAI(
      transcript,
      messages,
      // OnChunk handler
      (content) => {
        sendTabMessage(tabId, {
          action: 'chatChunk',
          content: content
        }).catch(err => {
          // Continue processing - don't break the loop
        });
      },
      // OnComplete handler
      () => {
        sendTabMessage(tabId, { action: 'chatComplete' })
          .catch(err => {
            // Error handling
          });
      },
      // OnError handler
      (error, needsApiKey) => {
        sendTabMessage(tabId, {
          action: 'chatError',
          error: error,
          needsApiKey: needsApiKey
        });
      },
      generationId // Pass generation ID for possible cancellation
    );
  } catch (error: any) {
    sendTabMessage(tabId, {
      action: 'chatError',
      error: error instanceof Error ? error.message : 'Unknown error',
      needsApiKey: false
    });
  }
}

// Add storage change listener to reset client when API key changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.openaiApiKey) {
    console.log('API key changed, resetting client');
    resetClient();
  }
});
