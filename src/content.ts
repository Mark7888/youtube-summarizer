import { renderMarkdown, sanitizeHtml, createMarkdownStyles } from './markdownRenderer';

// Add a state tracker for generation process
const generationState = new Map<string, boolean>();

// Track accumulated markdown text for each tab
const markdownContent = new Map<string, string>();

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
    // Get tab ID-based key for tracking state
    const stateKey = window.location.href;
    
    // Set this tab as currently generating
    generationState.set(stateKey, true);
    
    // Show loading overlay
    showSummaryOverlay('Loading transcript...');
    updateRegenerateButtonVisibility();
    
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
                // Mark generation as complete on error
                generationState.set(stateKey, false);
                updateRegenerateButtonVisibility();
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

// Create and show the summary overlay with additional buttons
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
        width: 25%;
        max-width: 550px;
        min-width: 350px;
        height: 40%;
        max-height: 600px;
        min-height: 300px;
        background-color: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        resize: both;
        overflow: hidden;
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
        cursor: move;
    `;
    
    // Left side - title and action buttons
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Video Summary';
    title.style.margin = '0';
    headerLeft.appendChild(title);
    
    // Copy button
    const copyBtn = createCopyButton();
    headerLeft.appendChild(copyBtn);
    
    // Regenerate button (refresh icon)
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'yt-summarizer-regenerate-btn';
    regenerateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#555">
            <path d="M17.65 6.35c-1.63-1.63-3.94-2.57-6.48-2.31-3.67.37-6.69 3.35-7.1 7.02C3.52 15.91 7.27 20 12 20c3.19 0 5.93-1.87 7.21-4.56.32-.67-.16-1.44-.9-1.44-.37 0-.72.2-.88.53-1.13 2.43-3.84 3.97-6.8 3.31-2.22-.49-4.01-2.3-4.48-4.52-.82-3.88 2.24-7.32 5.95-7.32 1.57 0 2.97.6 4.05 1.56L13 10h9V1l-4.35 4.35z"/>
        </svg>
    `;
    regenerateBtn.title = "Regenerate summary";
    regenerateBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
        visibility: hidden;
    `;
    regenerateBtn.addEventListener('mouseover', () => {
        regenerateBtn.style.opacity = '1';
    });
    regenerateBtn.addEventListener('mouseout', () => {
        regenerateBtn.style.opacity = '0.7';
    });
    regenerateBtn.addEventListener('click', () => {
        const videoUrl = window.location.href;
        startSummarization(videoUrl);
    });
    headerLeft.appendChild(regenerateBtn);
    
    // Right side - close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 0 5px;
    `;
    closeBtn.onclick = () => {
        overlay.remove();
        // Clear generation state when closing
        generationState.delete(window.location.href);
    };
    
    // Assemble header
    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'yt-summarizer-content markdown-body';
    content.style.cssText = `
        padding: 15px;
        overflow-y: auto;
        flex-grow: 1;
        overflow-wrap: break-word;
    `;
    
    // Add markdown styles
    const styleEl = document.createElement('style');
    styleEl.textContent = createMarkdownStyles();
    document.head.appendChild(styleEl);
    
    // Set initial content
    if (initialText) {
        content.textContent = initialText;
    }
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Update regenerate button visibility based on current state
    updateRegenerateButtonVisibility();
}

// Function to update regenerate button visibility
function updateRegenerateButtonVisibility() {
    const regenerateBtn = document.querySelector('.yt-summarizer-regenerate-btn') as HTMLButtonElement;
    if (!regenerateBtn) return;
    
    const stateKey = window.location.href;
    const isGenerating = generationState.get(stateKey) === true;
    
    regenerateBtn.style.visibility = isGenerating ? 'hidden' : 'visible';
    regenerateBtn.disabled = isGenerating;
}

// Update the content of the summary overlay
function updateSummaryOverlay(text: string, append: boolean = false) {
    const content = document.querySelector('.yt-summarizer-content');
    if (content) {
        if (append) {
            // For appending, just add to the current content
            content.textContent += text;
        } else {
            // For replacing, set the text directly
            content.textContent = text;
            
            // Reset markdown content for this page
            markdownContent.set(window.location.href, text);
        }
    } else {
        // If overlay doesn't exist yet, create it
        showSummaryOverlay(text);
    }
}

// New function to update the overlay with markdown content
async function updateMarkdownOverlay(markdownText: string) {
    const content = document.querySelector('.yt-summarizer-content') as HTMLElement;
    if (!content) return;
    
    try {
        // Render and sanitize markdown - handling async nature
        const html = await renderMarkdown(markdownText);
        const safeHtml = sanitizeHtml(html);
        
        // Update the content
        content.innerHTML = safeHtml;
    } catch (error) {
        console.error('Error rendering markdown:', error);
        content.textContent = markdownText;
    }
}

// Function to handle copy button click with markdown
function copyTextToClipboard() {
    const stateKey = window.location.href;
    const markdown = markdownContent.get(stateKey) || '';
    
    if (markdown) {
        navigator.clipboard.writeText(markdown)
            .catch(err => {
                console.error('Failed to copy markdown:', err);
            });
    }
}

// Update copy button event listener in showSummaryOverlay
function createCopyButton() {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'yt-summarizer-copy-btn';
    copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#555">
            <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
    `;
    copyBtn.title = "Copy to clipboard";
    copyBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
    `;
    copyBtn.addEventListener('mouseover', () => {
        copyBtn.style.opacity = '1';
    });
    copyBtn.addEventListener('mouseout', () => {
        copyBtn.style.opacity = '0.7';
    });
    copyBtn.addEventListener('click', () => {
        const stateKey = window.location.href;
        const markdown = markdownContent.get(stateKey) || '';
        
        if (markdown) {
            navigator.clipboard.writeText(markdown)
                .then(() => {
                    // Visual feedback for copy
                    const originalInnerHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#4CAF50">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    `;
                    setTimeout(() => {
                        copyBtn.innerHTML = originalInnerHTML;
                    }, 1500);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                });
        }
    });
    return copyBtn;
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
        // Get the current tab's key
        const stateKey = window.location.href;
        
        // Get or initialize the markdown content for this page
        let currentMarkdown = markdownContent.get(stateKey) || '';
        const content = document.querySelector('.yt-summarizer-content');
        
        if (content) {
            // Check if this is the first chunk (content contains placeholder text)
            if (content.textContent === 'Generating summary...') {
                // Start fresh with this first chunk
                currentMarkdown = message.content;
            } else {
                // Append to existing content for subsequent chunks
                currentMarkdown += message.content;
            }
            
            // Store the updated markdown
            markdownContent.set(stateKey, currentMarkdown);
            
            // Render the updated markdown (now with async handling)
            updateMarkdownOverlay(currentMarkdown);
        }
    }
    
    if (message.action === 'summaryComplete') {
        console.log('Summary generation complete');
        
        // Mark generation as complete
        const stateKey = window.location.href;
        generationState.set(stateKey, false);
        
        // Update button visibility
        updateRegenerateButtonVisibility();
    }
    
    if (message.action === 'summaryError') {
        updateSummaryOverlay(`Error: ${message.error || 'Failed to generate summary'}`);
        
        // Mark generation as complete on error
        const stateKey = window.location.href;
        generationState.set(stateKey, false);
        updateRegenerateButtonVisibility();
        
        // If API key is needed, show the API key prompt
        if (message.needsApiKey) {
            setTimeout(() => {
                showApiKeyPrompt();
            }, 2000); // Show after a short delay so user can read the error
        }
    }
    
    return true;
});
