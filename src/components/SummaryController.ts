import { showSummaryOverlay, updateSummaryOverlay, updateRegenerateButtonVisibility } from './SummaryOverlay';
import transcriptTab from '../tabs/transcriptTab';
import { showApiKeyPrompt } from './ApiKeyPrompt';
import conversationTab from '../tabs/conversationTab';

// State management
export const generationState = new Map<string, boolean>();

// Track accumulated markdown text for each tab
export const markdownContent = new Map<string, string>();

// Start the summarization process
export function startSummarization(videoUrl: string): void {
    // Get tab ID-based key for tracking state
    const stateKey = window.location.href;
    
    // Set this tab as currently generating
    generationState.set(stateKey, true);
    
    // Show loading overlay
    showSummaryOverlay('Loading transcript...');
    updateRegenerateButtonVisibility();
    
    // Send message to background script - with proper error handling
    try {
        chrome.runtime.sendMessage(
            { action: 'summarize', videoUrl },
            (response) => {
                // Handle potential runtime errors
                if (chrome.runtime.lastError) {
                    updateSummaryOverlay(`Error: ${chrome.runtime.lastError.message || 'Connection failed'}`);
                    generationState.set(stateKey, false);
                    updateRegenerateButtonVisibility();
                    return;
                }
                
                if (!response || !response.success) {
                    if (response?.needsApiKey) {
                        showApiKeyPrompt();
                    } else {
                        updateSummaryOverlay(`Error: ${(response?.error) || 'Unknown error occurred'}`);
                    }
                    // Mark generation as complete on error
                    generationState.set(stateKey, false);
                    updateRegenerateButtonVisibility();
                    return;
                }
                
                if (response.action === 'prepareSummary') {
                    updateSummaryOverlay('Generating summary...');
                    
                    // If we have a transcript, pass it to the transcript tab
                    if (response.transcript) {
                        transcriptTab.handleTranscriptLoaded(response.transcript);
                        conversationTab.handleTranscriptLoaded(response.transcript);
                    }
                    
                    // Request the actual summary - simplified to avoid waiting for a response
                    try {
                        chrome.runtime.sendMessage(
                            { action: 'generateSummary', transcript: response.transcript }
                        );
                    } catch (err) {
                        updateSummaryOverlay('Error: Failed to start summary generation');
                        generationState.set(stateKey, false);
                        updateRegenerateButtonVisibility();
                    }
                }
            }
        );
    } catch (err) {
        updateSummaryOverlay('Error: Failed to communicate with extension background process');
        generationState.set(stateKey, false);
        updateRegenerateButtonVisibility();
    }
}
