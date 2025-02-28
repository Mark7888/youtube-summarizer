document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const messageDiv = document.getElementById('message') as HTMLDivElement;

    // Load saved API key
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
    });

    // Save API key
    saveBtn.addEventListener('click', () => {
        saveApiKey(apiKeyInput.value);
    });

    function saveApiKey(apiKey: string) {
        const trimmedKey = apiKey.trim();
        
        if (!trimmedKey) {
            showMessage('Please enter your OpenAI API key', 'error');
            return;
        }

        chrome.storage.sync.set({ openaiApiKey: trimmedKey }, () => {
            showMessage('API key saved successfully', 'success');
            
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
