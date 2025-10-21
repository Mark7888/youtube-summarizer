import { addSummarizeButton } from './components/SummarizeButton';
import { showSummaryOverlay, updateSummaryOverlay, updateMarkdownOverlay } from './components/SummaryOverlay';
import { generationState, markdownContent } from './components/SummaryController';
import { showApiKeyPrompt } from './components/ApiKeyPrompt';
import { YoutubeTranscriptContentFetcher } from './apis/youtubeTranscriptContentFetcher';
import type { TranscriptMessage, TranscriptResponse } from './types/transcriptMessages';

// Run when page loads
window.addEventListener('yt-navigate-finish', addSummarizeButton);

// Also run when navigation happens within YouTube (it's a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('youtube.com/watch')) {
            setTimeout(addSummarizeButton, 1000);
        }
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script with proper error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === 'updateSummary') {
            // Get the current tab's key
            const stateKey = window.location.href;
            
            // Get or initialize the markdown content for this page
            let currentMarkdown = markdownContent.get(stateKey) || '';
            const content = document.querySelector('.yt-summarizer-content');
            
            if (content) {
                // Check if this is the first chunk (content contains placeholder text)
                if (content.textContent === 'Generating summary...') {
                    // Start fresh with this first chunk
                    currentMarkdown = message.content;
                } else {
                    // Append to existing content for subsequent chunks
                    currentMarkdown += message.content;
                }
                
                // Store the updated markdown
                markdownContent.set(stateKey, currentMarkdown);
                
                // Render the updated markdown (now with async handling)
                updateMarkdownOverlay(currentMarkdown).catch(err => {
                    // Error handling
                });
            }
            
            // Pass generation ID to updateSummaryOverlay
            updateSummaryOverlay(message.content, true, message.generationId);
            sendResponse({ received: true });
            return true;
        }
        
        if (message.action === 'summaryComplete') {
            // Mark generation as complete
            const stateKey = window.location.href;
            generationState.set(stateKey, false);
            
            // No need to update button visibility anymore
            
            sendResponse({ received: true });
            return true;
        }
        
        if (message.action === 'summaryError') {
            // Mark generation as complete on error
            const stateKey = window.location.href;
            generationState.set(stateKey, false);
            
            // No need to update button visibility anymore
            
            // Handle error display in the SummaryController component
            updateSummaryOverlay(`Error: ${message.error}`, false, message.generationId);
            
            if (message.needsApiKey) {
                showApiKeyPrompt();
            }
            
            sendResponse({ received: true });
            return true;
        }
        
        // Handle cancellation confirmation
        if (message.action === 'generationCancelled') {
            const stateKey = window.location.href;
            generationState.set(stateKey, false);
            sendResponse({ received: true });
            return true;
        }
        
        // These are the chat actions - forward them to any listeners
        // (ConversationTab will pick them up via its own listener)
        if (message.action === 'chatChunk' || 
            message.action === 'chatComplete' || 
            message.action === 'chatError' ||
            message.action === 'chatResponse') {
            // No action needed here - the conversation tab will handle these
        }
    } catch (err) {
        console.error('Error processing message:', err);
    }
    
    // Always return true (acknowledge receipt) to prevent channel closing errors
    return true;
});

// Add message listener for transcript requests
chrome.runtime.onMessage.addListener((message: TranscriptMessage, sender, sendResponse) => {
    if (message.type === 'FETCH_TRANSCRIPT') {
        YoutubeTranscriptContentFetcher.fetchTranscript(message.videoId, message.lang)
            .then(data => {
                sendResponse({ success: true, data });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    errorType: error.message.split(':')[0]
                });
            });
        return true; // Keep channel open for async response
    }
    
    if (message.type === 'GET_LANGUAGES') {
        YoutubeTranscriptContentFetcher.getLanguages(message.videoId)
            .then(data => {
                sendResponse({ success: true, data });
            })
            .catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    errorType: error.message.split(':')[0]
                });
            });
        return true; // Keep channel open for async response
    }
});
