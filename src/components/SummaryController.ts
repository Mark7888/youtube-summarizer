import { showSummaryOverlay, updateSummaryOverlay, getCurrentLanguage, setCurrentLanguage } from './SummaryOverlay';
import transcriptTab from '../tabs/transcriptTab';
import { showApiKeyPrompt } from './ApiKeyPrompt';
import conversationTab from '../tabs/conversationTab';

// State management
export const generationState = new Map<string, boolean>();

// Track accumulated markdown text for each tab
export const markdownContent = new Map<string, string>();

// Track current generation language to detect changes
export const currentGenerationLanguage = new Map<string, string>();

// Start the summarization process
export function startSummarization(videoUrl: string, language?: string | undefined): void {
    // Get tab ID-based key for tracking state
    const stateKey = window.location.href;
    
    // Check if we're already generating 
    const isCurrentlyGenerating = generationState.get(stateKey) === true;
    
    // If there's an active generation, cancel it first
    if (isCurrentlyGenerating) {
        // Cancel the current generation
        cancelGeneration();
    }
    
    // Update the current generation language
    currentGenerationLanguage.set(stateKey, language || '');
    
    // Set this tab as currently generating
    generationState.set(stateKey, true);
    
    // Show loading overlay
    const isLanguageChange = isCurrentlyGenerating && language !== undefined;
    showSummaryOverlay(isLanguageChange ? `Changing language to ${language || 'default'}...` : 'Loading transcript...');
    
    // Send message to background script - with proper error handling
    try {
        chrome.runtime.sendMessage(
            { action: 'summarize', videoUrl, language }, 
            (response) => {
                // Handle potential runtime errors
                if (chrome.runtime.lastError) {
                    updateSummaryOverlay(`Error: ${chrome.runtime.lastError.message || 'Connection failed'}`);
                    generationState.set(stateKey, false);
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
                    return;
                }
                
                if (response.action === 'prepareSummary') {
                    updateSummaryOverlay('Generating summary...');
                    
                    // Set the current language based on what was actually used
                    if (response.language || response.vssId) {
                        setCurrentLanguage(response.language, response.vssId);
                    }
                    
                    // If we have a transcript, pass it to the transcript tab
                    if (response.transcript) {
                        transcriptTab.handleTranscriptLoaded(response.transcript);
                        conversationTab.handleTranscriptLoaded(response.transcript);
                    }
                    
                    // Request the actual summary - simplified to avoid waiting for a response
                    try {
                        chrome.runtime.sendMessage(
                            { 
                                action: 'generateSummary', 
                                transcript: response.transcript,
                                language: language,
                                generationId: Date.now().toString() // Add a unique generation ID
                            }
                        );
                    } catch (err) {
                        updateSummaryOverlay('Error: Failed to start summary generation');
                        generationState.set(stateKey, false);
                    }
                }
            }
        );
    } catch (err) {
        updateSummaryOverlay('Error: Failed to communicate with extension background process');
        generationState.set(stateKey, false);
    }
}

// Cancel the current generation
export function cancelGeneration(): void {
    const stateKey = window.location.href;
    
    // Tell the background script to cancel any ongoing generations
    try {
        chrome.runtime.sendMessage({
            action: 'cancelGeneration',
            url: stateKey
        });
    } catch (err) {
        console.error('Failed to cancel generation:', err);
    }
}

// Check if there is an active generation
export function isGenerating(): boolean {
    const stateKey = window.location.href;
    return generationState.get(stateKey) === true;
}
