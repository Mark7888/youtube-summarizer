console.log('Background script running');

import { YoutubeTranscript } from 'youtube-transcript';
import { OpenAI } from 'openai';

let client: OpenAI | null = null;

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that summarizes YouTube video transcripts clearly and concisely. Focus on the main points, key details, and important takeaways. Format your response using Markdown with headings, bullet points, and emphasis where appropriate.';

// Available models
const AVAILABLE_MODELS = [
    'gpt-4o-mini'
    // Add more models here as needed
];

// Default model to use
const DEFAULT_MODEL = 'gpt-4o-mini';

// Initialize OpenAI client
async function initializeOpenAIClient(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['openaiApiKey'], (result) => {
            if (result.openaiApiKey && result.openaiApiKey.trim() !== '') {
                try {
                    client = new OpenAI({
                        apiKey: result.openaiApiKey,
                    });
                    resolve({ success: true });
                } catch (error) {
                    // console.error('Error initializing OpenAI client:', error);
                    resolve({ success: false, error: 'Failed to initialize OpenAI client' });
                }
            } else {
                resolve({ success: false, error: 'No API key found' });
            }
        });
    });
}

// Function to validate API key with a simple test request
async function validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    if (!client) {
        return { valid: false, error: 'Client not initialized' };
    }

    try {
        // Make a minimal API call to check if the key is valid
        await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1 // Minimize token usage for the test
        });
        return { valid: true };
    } catch (error: any) {
        // console.error('API key validation error:', error);
        
        // Check for 401 error (invalid API key)
        if (error?.status === 401 || 
            error?.message?.includes('401') || 
            error?.message?.includes('Incorrect API key provided')) {
            
            // Clear the invalid API key
            chrome.storage.sync.remove('openaiApiKey', () => {
                console.log('Invalid API key removed from storage');
            });
            
            return { valid: false, error: 'Invalid API key' };
        }
        
        return { valid: true }; // Other errors might be temporary or unrelated to the key
    }
}

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
                // console.error('Error in handleSummarize:', error);
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
                // console.error('Error checking API key:', error);
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
        client = null;
        console.log('OpenAI client reset');
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

// Check API key and initialize client
async function checkApiKeyAndInitClient() {
    const initResult = await initializeOpenAIClient();
    
    if (initResult.success) {
        // Validate the API key if initialization was successful
        const validationResult = await validateApiKey();
        if (!validationResult.valid) {
            return { success: false, error: validationResult.error, needsApiKey: true };
        }
    }
    
    return initResult;
}

// Handle summarizing process - now returns a Promise
async function handleSummarize(videoId: string, sendResponse: (response: any) => void): Promise<void> {
    try {
        // First, check if OpenAI client is initialized
        if (!client) {
            const initResult = await initializeOpenAIClient();
            if (!initResult.success) {
                sendResponse({ 
                    success: false, 
                    error: initResult.error || 'No API key found',
                    needsApiKey: true 
                });
                return;
            }
            
            // Validate the API key
            const validationResult = await validateApiKey();
            if (!validationResult.valid) {
                sendResponse({ 
                    success: false, 
                    error: validationResult.error || 'Invalid API key',
                    needsApiKey: true 
                });
                return;
            }
        }

        // Fetch transcript
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        const fullTranscript = transcript.map(part => part.text).join(' ');
        
        if (fullTranscript.length === 0) {
            sendResponse({ 
                success: false, 
                error: 'No transcript available for this video' 
            });
            return;
        }

        // Send successful response with transcript
        sendResponse({
            success: true,
            action: 'prepareSummary',
            transcript: fullTranscript
        });
        
    } catch (error) {
        // console.error('Error in handleSummarize:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process video'
        });
    }
}

// Helper function to extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Get system prompt from storage or use default
async function getSystemPrompt(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get('systemPrompt', (result) => {
            resolve(result.systemPrompt || DEFAULT_SYSTEM_PROMPT);
        });
    });
}

// Get model from storage or use default
async function getModel(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get('model', (result) => {
            resolve(result.model || DEFAULT_MODEL);
        });
    });
}

// Summarize transcript using OpenAI - now properly handles errors
async function getSummaryOpenAI(transcript: string, tabId: number): Promise<void> {
    try {
        if (!client) {
            const initResult = await initializeOpenAIClient();
            if (!initResult.success) {
                // Send error to tab
                sendTabMessage(tabId, {
                    action: 'summaryError',
                    error: initResult.error || 'Failed to initialize OpenAI client',
                    needsApiKey: true
                });
                return;
            }
        }

        // Get the custom system prompt and selected model
        const systemPrompt = await getSystemPrompt();
        const model = await getModel();

        // Truncate transcript if it's too long
        const maxLength = 15000;
        const truncatedTranscript = transcript.length > maxLength 
            ? transcript.substring(0, maxLength) + "..." 
            : transcript;
        
        // Enhance the user prompt to encourage markdown formatting
        const userPrompt = `Please summarize the following transcript from a YouTube video. Use markdown formatting to structure your response - include headers for main sections, bullet points for key details, and emphasis for important points.\n\n${truncatedTranscript}`;

        try {
            // Start stream
            const stream = await client!.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: true,
            });

            // Process stream chunks
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    // Send each chunk to the content script using the safe send method
                    // Keep streaming even if some chunks fail to send
                    sendTabMessage(tabId, {
                        action: 'updateSummary',
                        content: content
                    }).catch(err => {
                        // console.error('Failed to send chunk:', err);
                        // Continue processing - don't break the loop
                    });
                }
            }
            
            // Signal that streaming is complete
            sendTabMessage(tabId, { action: 'summaryComplete' })
                .catch(err => {
                    // console.error('Error sending completion notification:', err);
                });
        } catch (error: any) {
            // console.error('Error with OpenAI API:', error);
            
            // Check for 401 error (invalid API key)
            if (error?.status === 401 || 
                error?.message?.includes('401') || 
                error?.message?.includes('Incorrect API key provided')) {
                
                // Clear the invalid API key
                await chrome.storage.sync.remove('openaiApiKey');
                
                // Inform user about invalid API key
                sendTabMessage(tabId, {
                    action: 'summaryError',
                    error: 'Invalid API key. Please provide a valid OpenAI API key.',
                    needsApiKey: true
                });
            } else if (error?.message?.includes('does not exist') || 
                     error?.message?.includes('invalid model')) {
                // Handle invalid model error
                sendTabMessage(tabId, {
                    action: 'summaryError',
                    error: `Invalid model: "${await getModel()}". Please select a different model in settings.`
                });
            } else {
                // For other errors
                sendTabMessage(tabId, {
                    action: 'summaryError',
                    error: 'Failed to generate summary with OpenAI: ' + (error.message || 'Unknown error')
                });
            }
        }
    } catch (error: any) {
        // console.error('Unexpected error in getSummaryOpenAI:', error);
        
        // Attempt to notify the content script
        sendTabMessage(tabId, {
            action: 'summaryError',
            error: 'An unexpected error occurred'
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

// Add storage change listener to reset client when API key changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.openaiApiKey) {
        console.log('API key changed, resetting client');
        client = null;
    }
});
