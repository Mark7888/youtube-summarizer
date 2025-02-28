console.log('Background script running');

import { YoutubeTranscript } from 'youtube-transcript';
import { OpenAI } from 'openai';

let client: OpenAI | null = null;

// Initialize OpenAI client
async function initializeOpenAIClient(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['openaiApiKey'], (result) => {
            if (result.openaiApiKey) {
                try {
                    client = new OpenAI({
                        apiKey: result.openaiApiKey,
                    });
                    resolve({ success: true });
                } catch (error) {
                    console.error('Error initializing OpenAI client:', error);
                    resolve({ success: false, error: 'Failed to initialize OpenAI client' });
                }
            } else {
                resolve({ success: false, error: 'No API key found' });
            }
        });
    });
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

        handleSummarize(videoId, sendResponse);
        return true; // Keep the message channel open for async responses
    }
    
    if (message.action === 'checkApiKey') {
        checkApiKeyAndInitClient().then(response => {
            sendResponse(response);
        });
        return true; // Keep the message channel open for async responses
    }
    
    return false;
});

// Check API key and initialize client
async function checkApiKeyAndInitClient() {
    const result = await initializeOpenAIClient();
    return result;
}

// Handle summarizing process
async function handleSummarize(videoId: string, sendResponse: (response: any) => void) {
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

        // Start the summarization process
        sendResponse({
            success: true,
            action: 'prepareSummary',
            transcript: fullTranscript
        });
        
    } catch (error) {
        console.error('Error in handleSummarize:', error);
        sendResponse({
            success: false,
            error: 'Failed to process video'
        });
    }
}

// Helper function to extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Summarize transcript using OpenAI GPT-4o-mini
async function getSummaryOpenAI(transcript: string, tabId: number) {
    if (!client) {
        const initResult = await initializeOpenAIClient();
        if (!initResult.success) {
            return { success: false, error: initResult.error };
        }
    }

    try {
        // Truncate transcript if it's too long
        const maxLength = 15000;
        const truncatedTranscript = transcript.length > maxLength 
            ? transcript.substring(0, maxLength) + "..." 
            : transcript;
        
        // Start stream
        const stream = await client!.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that summarizes YouTube video transcripts clearly and concisely. Focus on the main points, key details, and important takeaways.'
                },
                {
                    role: 'user',
                    content: `Please summarize the following transcript from a YouTube video:\n\n${truncatedTranscript}`
                }
            ],
            stream: true,
        });

        // Process stream chunks
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                // Send each chunk to the content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'updateSummary',
                    content: content
                });
            }
        }
        
        // Signal that streaming is complete
        chrome.tabs.sendMessage(tabId, {
            action: 'summaryComplete'
        });
        
        return { success: true };

    } catch (error) {
        console.error('Error with OpenAI API:', error);
        chrome.tabs.sendMessage(tabId, {
            action: 'summaryError',
            error: 'Failed to generate summary with OpenAI'
        });
        return { success: false, error: 'API request failed' };
    }
}

// Add listener for content script requesting an actual summary
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'generateSummary' && sender.tab?.id) {
        const tabId = sender.tab.id;
        getSummaryOpenAI(message.transcript, tabId)
            .then(result => {
                sendResponse(result);
            })
            .catch(err => {
                console.error(err);
                sendResponse({ success: false, error: 'Summarization process failed' });
            });
        return true; // Keep the message channel open
    }
    return false;
});
