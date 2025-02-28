// Define the default system prompt
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant that summarizes YouTube video transcripts clearly and concisely. Focus on the main points, key details, and important takeaways.';

// Define available models (sync with background.ts)
const AVAILABLE_MODELS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    // Add more models as needed
];

// Default model
const DEFAULT_MODEL = 'gpt-4o-mini';

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const systemPromptInput = document.getElementById('systemPrompt') as HTMLTextAreaElement;
    const modelSelect = document.getElementById('modelSelect') as HTMLSelectElement;
    const customModelInput = document.getElementById('customModel') as HTMLInputElement;
    const customModelContainer = document.getElementById('customModelContainer') as HTMLDivElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;

    // Populate model dropdown
    populateModelDropdown();

    // Show/hide custom model input based on selection
    modelSelect.addEventListener('change', () => {
        customModelContainer.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
    });

    // Load saved settings
    chrome.storage.sync.get(['openaiApiKey', 'systemPrompt', 'model'], (result) => {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
        
        systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        
        // Handle model selection
        if (result.model) {
            // Check if the saved model is in our predefined list
            if (modelExists(result.model)) {
                modelSelect.value = result.model;
            } else {
                // It's a custom model
                modelSelect.value = 'custom';
                customModelInput.value = result.model;
                customModelContainer.style.display = 'block';
            }
        } else {
            // Default model if none is saved
            modelSelect.value = DEFAULT_MODEL;
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        saveSettings();
    });

    function modelExists(modelName: string): boolean {
        // Check if model name exists in the select options (excluding custom)
        for (let i = 0; i < modelSelect.options.length; i++) {
            const option = modelSelect.options[i];
            if (option.value !== 'custom' && option.value === modelName) {
                return true;
            }
        }
        return false;
    }

    function populateModelDropdown() {
        // Clear existing options
        while (modelSelect.options.length > 0) {
            modelSelect.remove(0);
        }
        
        // Add available models
        AVAILABLE_MODELS.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            
            // Mark the default model
            if (model === DEFAULT_MODEL) {
                option.textContent = `${model} (Default)`;
                option.style.fontWeight = 'bold';
                option.style.backgroundColor = '#f0f7ff';
            } else {
                option.textContent = model;
            }
            
            modelSelect.add(option);
        });
        
        // Add custom option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom model...';
        modelSelect.add(customOption);
    }

    function saveSettings() {
        const apiKey = apiKeyInput.value.trim();
        let systemPrompt = systemPromptInput.value.trim();
        
        // Get selected model
        let model = modelSelect.value;
        
        // If custom is selected, get the custom model name
        if (model === 'custom') {
            const customModel = customModelInput.value.trim();
            if (!customModel) {
                showMessage('Please enter a custom model name', 'error');
                return;
            }
            model = customModel;
        }
        
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
            systemPrompt: systemPrompt,
            model: model
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
