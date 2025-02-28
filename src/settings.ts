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
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showMessage('Please enter your OpenAI API key', 'error');
            return;
        }

        chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
            showMessage('API key saved successfully', 'success');
        });
    });

    function showMessage(text: string, type: 'success' | 'error') {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
});
