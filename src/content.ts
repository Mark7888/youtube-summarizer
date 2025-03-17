import { addSummarizeButton } from './components/SummarizeButton';
import { showSummaryOverlay, updateMarkdownOverlay } from './components/SummaryOverlay';
import { generationState, markdownContent } from './components/SummaryController';

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
chrome.runtime.onMessage.addListener((message) => {
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
        }
        
        if (message.action === 'summaryComplete') {
            // Mark generation as complete
            const stateKey = window.location.href;
            generationState.set(stateKey, false);
        }
        
        if (message.action === 'summaryError') {
            // Handle error display in the SummaryController component
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
        // Error handling
    }
    
    // Always return true (acknowledge receipt) to prevent channel closing errors
    return true;
});
