import { OpenAI } from 'openai';

// Default system prompt
export const DEFAULT_SUMMARY_SYSTEM_PROMPT = 'You are a helpful assistant that summarizes YouTube video transcripts clearly and concisely. Focus on the main points, key details, and important takeaways. Format your response using Markdown with headings, bullet points, and emphasis where appropriate.';

// Default chat system prompt
export const DEFAULT_CHAT_SYSTEM_PROMPT = 'You are a helpful assistant discussing a YouTube video. Refer to the transcript context provided to answer questions and engage in conversation about the video content. Be informative, concise, and accurate.';

// Available models
export const AVAILABLE_MODELS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    // Add more models here as needed
];

// Default model to use
export const DEFAULT_MODEL = 'gpt-4o-mini';

// Interface for chat messages
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

var client: OpenAI | null = null;

// Track active requests by ID for cancellation
const activeRequests = new Map<string, AbortController>();

// Cancel a specific generation by ID
export function cancelGeneration(generationId?: string): void {
  if (!generationId) return;
  
  const controller = activeRequests.get(generationId);
  if (controller) {
    controller.abort();
    activeRequests.delete(generationId);
    console.log(`Cancelled generation ${generationId}`);
  }
}

/**
 * Initialize the OpenAI client with API key from storage
 */
export async function initializeOpenAIClient(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['openaiApiKey'], (result) => {
            if (result.openaiApiKey && result.openaiApiKey.trim() !== '') {
                try {
                    client = new OpenAI({
                        apiKey: result.openaiApiKey,
                    });
                    resolve({ success: true });
                } catch (error) {
                    resolve({ success: false, error: 'Failed to initialize OpenAI client' });
                }
            } else {
                resolve({ success: false, error: 'No API key found' });
            }
        });
    });
}

/**
 * Validate API key with a simple test request
 */
export async function validateApiKey(): Promise<{ valid: boolean; error?: string }> {
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

/**
 * Check API key and initialize client
 */
export async function checkApiKeyAndInitClient() {
    const initResult = await initializeOpenAIClient();

    if (!initResult.success) {
        // Check if the error is due to missing API key
        if (initResult.error === 'No API key found') {
            return { success: false, error: 'Please add your OpenAI API key in extension settings.', needsApiKey: true };
        }
        return { success: false, error: initResult.error || 'Failed to initialize OpenAI client', needsApiKey: true };
    }

    // Validate the API key if initialization was successful
    const validationResult = await validateApiKey();
    if (!validationResult.valid) {
        return { success: false, error: validationResult.error, needsApiKey: true };
    }

    return { success: true };
}

/**
 * Get system prompt from storage or use default
 */
export async function getSystemPrompt(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get('systemPrompt', (result) => {
            resolve(result.systemPrompt || DEFAULT_SUMMARY_SYSTEM_PROMPT);
        });
    });
}

/**
 * Get model from storage or use default
 */
export async function getModel(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get('model', (result) => {
            resolve(result.model || DEFAULT_MODEL);
        });
    });
}

/**
 * Reset the OpenAI client
 */
export function resetClient(): void {
    client = null;
    console.log('OpenAI client reset');
}

/**
 * Generate summary using OpenAI
 */
export async function generateSummary(
    transcript: string,
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (error: string, needsApiKey?: boolean) => void,
    generationId?: string
): Promise<void> {
    try {
        // Set up AbortController for cancellation
        const controller = new AbortController();
        if (generationId) {
            activeRequests.set(generationId, controller);
        }

        if (!client) {
            const initResult = await initializeOpenAIClient();
            if (!initResult.success) {
                onError(initResult.error || 'Failed to initialize OpenAI client', true);
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
            // Start stream - fixed to use the options parameter for the AbortController signal
            const stream = await client!.chat.completions.create(
                {
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    stream: true,
                },
                {
                    signal: controller.signal,
                }
            );

            // Process stream chunks
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    onChunk(content);
                }
            }

            // Signal that streaming is complete
            onComplete();
        } catch (error: any) {
            // Check if this is an abort error
            if (error.name === 'AbortError') {
                console.log('Request was aborted');
                return; // Exit silently for aborted requests
            }
            
            // Check for 401 error (invalid API key)
            if (error?.status === 401 ||
                error?.message?.includes('401') ||
                error?.message?.includes('Incorrect API key provided')) {

                // Clear the invalid API key
                await chrome.storage.sync.remove('openaiApiKey');

                // Inform user about invalid API key
                onError('Invalid API key. Please provide a valid OpenAI API key.', true);
            } else if (error?.message?.includes('does not exist') ||
                error?.message?.includes('invalid model')) {
                // Handle invalid model error
                onError(`Invalid model: "${await getModel()}". Please select a different model in settings.`);
            } else {
                // For other errors
                onError('Failed to generate summary with OpenAI: ' + (error.message || 'Unknown error'));
            }
        }

        // When complete, remove from active requests
        if (generationId) {
            activeRequests.delete(generationId);
        }
    } catch (error: any) {
        onError('An unexpected error occurred');

        // Clean up on error
        if (generationId) {
            activeRequests.delete(generationId);
        }
    }
}

/**
 * Get chat system prompt from storage or use default
 */
export async function getChatSystemPrompt(): Promise<string> {
    return new Promise((resolve) => {
        chrome.storage.sync.get('chatSystemPrompt', (result) => {
            resolve(result.chatSystemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT);
        });
    });
}

/**
 * Handle chat conversation with the AI about video content
 */
export async function chatWithAI(
    transcript: string,
    messages: ChatMessage[],
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (error: string, needsApiKey?: boolean) => void,
    generationId?: string
): Promise<void> {
    try {
        // Set up AbortController for cancellation if generationId is provided
        const controller = new AbortController();
        if (generationId) {
            activeRequests.set(generationId, controller);
        }

        if (!client) {
            const initResult = await initializeOpenAIClient();
            if (!initResult.success) {
                onError(initResult.error || 'Failed to initialize OpenAI client', true);
                return;
            }
        }

        // Get the custom chat system prompt and selected model
        const chatSystemPrompt = await getChatSystemPrompt();
        const model = await getModel();

        // Truncate transcript if it's too long
        const maxLength = 15000;
        const truncatedTranscript = transcript.length > maxLength
            ? transcript.substring(0, maxLength) + "..."
            : transcript;

        // Prepare the conversation messages
        const contextMessage = `Context (YouTube video transcript): ${truncatedTranscript}`;
        
        // Build the complete message history
        const completeMessages: ChatMessage[] = [
            { role: 'system', content: `${chatSystemPrompt}\n\n${contextMessage}` },
            ...messages
        ];

        try {
            // Start stream - fixed to use the options parameter for the AbortController signal
            const stream = await client!.chat.completions.create(
                {
                    model: model,
                    messages: completeMessages,
                    stream: true,
                },
                generationId ? { signal: controller.signal } : undefined
            );

            // Process stream chunks
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    onChunk(content);
                }
            }

            // Signal that streaming is complete
            onComplete();
        } catch (error: any) {
            // Check if this is an abort error
            if (error.name === 'AbortError') {
                console.log('Chat request was aborted');
                return; // Exit silently for aborted requests
            }
            
            // Handle errors similarly to generateSummary
            if (error?.status === 401 ||
                error?.message?.includes('401') ||
                error?.message?.includes('Incorrect API key provided')) {

                await chrome.storage.sync.remove('openaiApiKey');
                onError('Invalid API key. Please provide a valid OpenAI API key.', true);
            } else if (error?.message?.includes('does not exist') ||
                error?.message?.includes('invalid model')) {
                onError(`Invalid model: "${await getModel()}". Please select a different model in settings.`);
            } else {
                onError('Failed to process chat with OpenAI: ' + (error.message || 'Unknown error'));
            }
        }
        
        // When complete, remove from active requests
        if (generationId) {
            activeRequests.delete(generationId);
        }
    } catch (error: any) {
        onError('An unexpected error occurred during chat');
        
        // Clean up on error
        if (generationId) {
            activeRequests.delete(generationId);
        }
    }
}
