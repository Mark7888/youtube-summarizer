import { startSummarization } from './SummaryController';
import { getCurrentLanguage } from './SummaryOverlay';

// Show API key prompt overlay
export function showApiKeyPrompt(): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'yt-summarizer-api-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        font-family: Arial, sans-serif;
    `;
    
    modal.innerHTML = `
        <h2 style="margin-top: 0; font-size: 18px; color: #333;">API Key Required</h2>
        <p style="color: #555; font-size: 14px;">YouTube Summarizer needs your OpenAI API key to function.</p>
        <div style="margin-bottom: 15px;">
            <label for="api-key-input" style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 14px; color: #444;">OpenAI API Key:</label>
            <input id="api-key-input" type="text" placeholder="Enter your API key" 
                   style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #4285f4;">OpenAI's website</a>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <button id="cancel-api-key" style="padding: 8px 16px; cursor: pointer; border-radius: 4px; border: 1px solid #ddd; background-color: #f5f5f5; font-size: 14px;">Cancel</button>
            <button id="save-api-key" style="padding: 8px 16px; background-color: #4285f4; color: white; border: none; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: 500;">Save API Key</button>
        </div>
        <div id="popup-message" style="margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 14px; display: none; text-align: center;"></div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle cancel button
    document.getElementById('cancel-api-key')?.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });
    
    // Handle save button
    document.getElementById('save-api-key')?.addEventListener('click', () => {
        const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
        const apiKey = apiKeyInput.value.trim();
        const messageEl = document.getElementById('popup-message');
        
        if (!apiKey) {
            if (messageEl) {
                messageEl.textContent = 'Please enter a valid API key';
                messageEl.style.display = 'block';
                messageEl.style.backgroundColor = '#f8d7da';
                messageEl.style.color = '#721c24';
            } else {
                alert('Please enter a valid API key');
            }
            return;
        }
        
        // Save API key
        chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
            if (messageEl) {
                messageEl.textContent = 'API key saved successfully!';
                messageEl.style.display = 'block';
                messageEl.style.backgroundColor = '#d4edda';
                messageEl.style.color = '#155724';
                
                // Hide the message after 1.5 seconds and close the popup
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    // Try to summarize again with the current language
                    const videoUrl = window.location.href;
                    const currentLanguage = getCurrentLanguage();
                    startSummarization(videoUrl, currentLanguage);
                }, 1500);
            } else {
                document.body.removeChild(overlay);
                // Try to summarize again with the current language
                const videoUrl = window.location.href;
                const currentLanguage = getCurrentLanguage();
                startSummarization(videoUrl, currentLanguage);
            }
            
            // Reset the OpenAI client in the background script
            chrome.runtime.sendMessage({ action: 'resetApiClient' });
        });
    });
}
