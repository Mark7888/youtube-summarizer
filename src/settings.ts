// Define the default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that summarizes YouTube video transcripts clearly and concisely. Focus on the main points, key details, and important takeaways.';

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const systemPromptInput = document.getElementById('systemPrompt') as HTMLTextAreaElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;

    // Load saved settings
    chrome.storage.sync.get(['openaiApiKey', 'systemPrompt'], (result) => {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
        
        systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        saveSettings();
    });

    function saveSettings() {
        const apiKey = apiKeyInput.value.trim();
        let systemPrompt = systemPromptInput.value.trim();
        
        // Validate inputs
        if (!apiKey) {
            showMessage('Please enter your OpenAI API key', 'error');
            return;
        }
        
        // If system prompt is empty, use the default
        if (!systemPrompt) {
            systemPrompt = DEFAULT_SYSTEM_PROMPT;
            systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
        }

        // Save to storage
        chrome.storage.sync.set({ 
            openaiApiKey: apiKey,
            systemPrompt: systemPrompt
        }, () => {
            showMessage('Settings saved successfully', 'success');
            
            // Reset the OpenAI client in the background script
            chrome.runtime.sendMessage({ action: 'resetApiClient' });
        });
    }

    function showMessage(text: string, type: 'success' | 'error') {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
});
