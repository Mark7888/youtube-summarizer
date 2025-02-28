function addSummarizeButton() {
    // Wait for the buttons container to be available
    const checkForButtons = setInterval(() => {
        // Look for the top-level-buttons container
        const buttonsContainer = document.querySelector('#actions #actions-inner #menu ytd-menu-renderer #top-level-buttons-computed');
        console.log('Checking for buttons container...');
        console.log(buttonsContainer);

        if (buttonsContainer) {
            console.log('Buttons container found');
            clearInterval(checkForButtons);

            // Check if our button already exists
            if (document.querySelector('.summarize-button')) {
                return;
            }

            // Find the share button to use as a template
            const shareButton = buttonsContainer.querySelector('yt-button-view-model') as HTMLElement;
            console.log(shareButton);
            if (!shareButton) return;

            // Create a new button element by cloning the share button
            const summarizeButton = shareButton.cloneNode(true) as HTMLElement;
            summarizeButton.classList.add('summarize-button');

            // Find the button element inside
            const buttonElement = summarizeButton.querySelector('button');
            if (buttonElement) {
                // Update button attributes
                buttonElement.setAttribute('aria-label', 'Summarize');
                buttonElement.setAttribute('title', 'Summarize');

                // Remove text content if it exists
                const textContentDiv = buttonElement.querySelector('.yt-spec-button-shape-next__button-text-content');
                if (textContentDiv) {
                    textContentDiv.textContent = '';
                }

                // Find the icon element and replace it with our custom icon
                const iconElement = buttonElement.querySelector('yt-icon');
                if (iconElement) {
                    // Helper function to create book SVG icon
                    const createBookIcon = () => {
                        const svgNamespace = "http://www.w3.org/2000/svg";
                        const svg = document.createElementNS(svgNamespace, "svg");
                        svg.setAttribute("viewBox", "0 0 24 24");
                        svg.setAttribute("height", "24");
                        svg.setAttribute("width", "24");

                        const path = document.createElementNS(svgNamespace, "path");
                        path.setAttribute("d", "M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z");

                        svg.appendChild(path);
                        return svg;
                    };

                    // Setup a mutation observer to wait for the icon to be fully loaded
                    const iconObserver = new MutationObserver(() => {
                        iconObserver.disconnect();

                        console.log('Setting icon using mutation observer');

                        // Clear the icon element and add our new SVG
                        while (iconElement.firstChild) {
                            iconElement.removeChild(iconElement.firstChild);
                        }
                        iconElement.appendChild(createBookIcon());
                    });

                    // Start observing the icon element for changes
                    iconObserver.observe(iconElement, {
                        childList: true,
                        subtree: true
                    });

                    // Fallback: If icon isn't loaded after 3 seconds, create a new one
                    setTimeout(() => {
                        iconObserver.disconnect();

                        if (!iconElement.querySelector('svg.summarize-icon')) {
                            console.log('Setting icon using fallback method');

                            // Clear the icon element and add our new SVG
                            while (iconElement.firstChild) {
                                iconElement.removeChild(iconElement.firstChild);
                            }
                            const icon = createBookIcon();
                            icon.classList.add('summarize-icon');
                            iconElement.appendChild(icon);
                        }
                    }, 3000);
                }
            }

            // Add click event listener
            summarizeButton.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();

                // First check if the API key is set
                chrome.runtime.sendMessage({ action: 'checkApiKey' }, (response) => {
                    if (!response.success) {
                        showApiKeyPrompt();
                    } else {
                        // API key is present, proceed with summarization
                        const videoUrl = window.location.href;
                        startSummarization(videoUrl);
                    }
                });
            });

            // Insert the button after the share button
            shareButton.insertAdjacentElement('afterend', summarizeButton);
            console.log('Summarize button added next to Share button');
        }
    }, 1000);
}

// Start the summarization process
function startSummarization(videoUrl: string) {
    // Show loading overlay
    showSummaryOverlay('Loading transcript...');
    
    // Send message to background script
    chrome.runtime.sendMessage(
        { action: 'summarize', videoUrl },
        (response) => {
            console.log('Response from background:', response);
            
            if (!response.success) {
                if (response.needsApiKey) {
                    showApiKeyPrompt();
                } else {
                    updateSummaryOverlay(`Error: ${response.error || 'Unknown error occurred'}`);
                }
                return;
            }
            
            if (response.action === 'prepareSummary') {
                updateSummaryOverlay('Generating summary...');
                // Request the actual summary
                chrome.runtime.sendMessage(
                    { action: 'generateSummary', transcript: response.transcript },
                    () => {}  // Empty callback as we'll handle updates via messages
                );
            }
        }
    );
}

// Show API key prompt
function showApiKeyPrompt() {
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
        max-width: 500px;
        width: 90%;
    `;
    
    modal.innerHTML = `
        <h2 style="margin-top: 0;">API Key Required</h2>
        <p>YouTube Summarizer needs your OpenAI API key to function.</p>
        <div style="margin-bottom: 15px;">
            <label for="api-key-input" style="display: block; margin-bottom: 5px;">OpenAI API Key:</label>
            <input id="api-key-input" type="text" placeholder="Enter your API key" 
                   style="width: 100%; padding: 8px; box-sizing: border-box;">
        </div>
        <div style="display: flex; justify-content: space-between;">
            <button id="cancel-api-key" style="padding: 8px 16px; cursor: pointer;">Cancel</button>
            <button id="save-api-key" style="padding: 8px 16px; background-color: #4285f4; color: white; border: none; cursor: pointer;">Save API Key</button>
        </div>
        <p style="font-size: 12px; margin-top: 15px;">
            You can get an API key from 
            <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI's website</a>.
        </p>
        <div id="popup-message" style="margin-top: 10px; padding: 8px; display: none;"></div>
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
                    // Try to summarize again
                    const videoUrl = window.location.href;
                    startSummarization(videoUrl);
                }, 1500);
            } else {
                document.body.removeChild(overlay);
                // Try to summarize again
                const videoUrl = window.location.href;
                startSummarization(videoUrl);
            }
            
            // Reset the OpenAI client in the background script
            chrome.runtime.sendMessage({ action: 'resetApiClient' });
        });
    });
}

// Create and show the summary overlay
function showSummaryOverlay(initialText: string = '') {
    // Remove any existing overlay
    const existingOverlay = document.querySelector('.yt-summarizer-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'yt-summarizer-overlay';
    overlay.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        max-height: 400px;
        background-color: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 10px;
        background-color: #f9f9f9;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 8px 8px 0 0;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Video Summary';
    title.style.margin = '0';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 0 5px;
    `;
    closeBtn.onclick = () => overlay.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'yt-summarizer-content';
    content.style.cssText = `
        padding: 15px;
        overflow-y: auto;
        flex-grow: 1;
    `;
    content.textContent = initialText;
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// Update the content of the summary overlay
function updateSummaryOverlay(text: string, append: boolean = false) {
    const content = document.querySelector('.yt-summarizer-content');
    if (content) {
        if (append) {
            content.textContent += text;
        } else {
            content.textContent = text;
        }
    } else {
        // If overlay doesn't exist yet, create it
        showSummaryOverlay(text);
    }
}

// Run when page loads
window.addEventListener('yt-navigate-finish', addSummarizeButton);

// Also run when navigation happens within YouTube (it's a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('youtube.com/watch')) {
            setTimeout(addSummarizeButton, 1000);
        }
    }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateSummary') {
        // Append the new content to the summary
        const content = document.querySelector('.yt-summarizer-content');
        if (content) {
            content.textContent += message.content;
        }
    }
    
    if (message.action === 'summaryComplete') {
        console.log('Summary generation complete');
    }
    
    if (message.action === 'summaryError') {
        updateSummaryOverlay(`Error: ${message.error || 'Failed to generate summary'}`);
        
        // If API key is needed, show the API key prompt
        if (message.needsApiKey) {
            setTimeout(() => {
                showApiKeyPrompt();
            }, 2000); // Show after a short delay so user can read the error
        }
    }
    
    return true;
});
