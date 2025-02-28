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

        if (buttonsContainer) {
            clearInterval(checkForButtons);

            // Check if our button already exists
            if (document.querySelector('.summarize-button')) {
                return;
            }

            // Find the share button to use as a template
            const shareButton = buttonsContainer.querySelector('yt-button-view-model') as HTMLElement;
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
    
    // Send message to background script - with proper error handling
    try {
        chrome.runtime.sendMessage(
            { action: 'summarize', videoUrl },
            (response) => {
                // Handle potential runtime errors
                if (chrome.runtime.lastError) {
                    // console.error('Runtime error:', chrome.runtime.lastError);
                    updateSummaryOverlay(`Error: ${chrome.runtime.lastError.message || 'Connection failed'}`);
                    generationState.set(stateKey, false);
                    updateRegenerateButtonVisibility();
                    return;
                }
                
                if (!response || !response.success) {
                    if (response?.needsApiKey) {
                        showApiKeyPrompt();
                    } else {
                        updateSummaryOverlay(`Error: ${(response?.error) || 'Unknown error occurred'}`);
                    }
                    // Mark generation as complete on error
                    generationState.set(stateKey, false);
                    updateRegenerateButtonVisibility();
                    return;
                }
                
                if (response.action === 'prepareSummary') {
                    updateSummaryOverlay('Generating summary...');
                    // Request the actual summary - simplified to avoid waiting for a response
                    try {
                        chrome.runtime.sendMessage(
                            { action: 'generateSummary', transcript: response.transcript }
                        );
                    } catch (err) {
                        // console.error('Error sending generateSummary message:', err);
                        updateSummaryOverlay('Error: Failed to start summary generation');
                        generationState.set(stateKey, false);
                        updateRegenerateButtonVisibility();
                    }
                }
            }
        );
    } catch (err) {
        // console.error('Error sending message to background script:', err);
        updateSummaryOverlay('Error: Failed to communicate with extension background process');
        generationState.set(stateKey, false);
        updateRegenerateButtonVisibility();
    }
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
        max-width: 800px;
        min-width: 350px;
        height: auto; /* Dynamic height */
        min-height: 100px; /* Smaller initial height */
        max-height: 600px;
        background-color: white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: none; /* Disable transitions to avoid sluggish dragging */
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
    
    // Right side - pin, minimize and close buttons
    const headerRight = document.createElement('div');
    headerRight.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    // Pin button (to restore to original position)
    const pinBtn = document.createElement('button');
    pinBtn.className = 'yt-summarizer-pin-btn';
    pinBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#aaa">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
        </svg>
    `;
    pinBtn.title = "Reset position to bottom-right";
    pinBtn.style.cssText = `
        background: none;
        border: none;
        cursor: default;
        padding: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        transition: opacity 0.2s;
        pointer-events: none;
    `;
    
    headerRight.appendChild(pinBtn);
    
    // Minimize/Maximize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'yt-summarizer-minimize-btn';
    minimizeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#555">
            <path d="M19 13H5v-2h14v2z"/>
        </svg>
    `;
    minimizeBtn.title = "Minimize";
    minimizeBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => {
        minimizeBtn.style.opacity = '1';
    });
    minimizeBtn.addEventListener('mouseout', () => {
        minimizeBtn.style.opacity = '0.7';
    });
    
    // Variable to store the original height when minimized
    let originalHeight: string | null = null;
    let isMinimized = false;
    
    minimizeBtn.addEventListener('click', () => {
        if (isMinimized) {
            // Maximize
            if (originalHeight) {
                overlay.style.height = originalHeight;
            }
            content.style.display = 'block';
            minimizeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#555">
                    <path d="M19 13H5v-2h14v2z"/>
                </svg>
            `;
            minimizeBtn.title = "Minimize";
            isMinimized = false;
        } else {
            // Minimize
            originalHeight = overlay.style.height;
            // Calculate header height and set overlay to that height
            const headerHeight = header.offsetHeight;
            overlay.style.height = `${headerHeight}px`;
            content.style.display = 'none';
            minimizeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#555">
                    <path d="M19 13H5v-2h14v2z"/>
                    <path d="M19 13H5v6h14v-6z"/>
                </svg>
            `;
            minimizeBtn.title = "Maximize";
            isMinimized = true;
        }
    });
    
    headerRight.appendChild(minimizeBtn);
    
    // Close button
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
    headerRight.appendChild(closeBtn);
    
    // Assemble header
    header.appendChild(headerLeft);
    header.appendChild(headerRight); // Use headerRight instead of directly appending closeBtn
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'yt-summarizer-content markdown-body';
    content.style.cssText = `
        padding: 15px;
        overflow-y: auto;
        flex-grow: 1;
        overflow-wrap: break-word;
        max-height: 500px; /* Keep scrollable area if content is long */
    `;
    
    // Add markdown styles
    const styleEl = document.createElement('style');
    styleEl.textContent = createMarkdownStyles();
    document.head.appendChild(styleEl);
    
    // Set initial content
    if (initialText) {
        content.textContent = initialText;
        // Schedule a height adjustment after content is set
        setTimeout(() => adjustOverlayHeight(), 10);
    }
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Add resize handles
    addResizeHandles(overlay);
    
    // Make the overlay draggable with pin functionality
    makeDraggable(overlay, header, pinBtn);
    
    // Update regenerate button visibility based on current state
    updateRegenerateButtonVisibility();
}

// Function to make an element draggable with pin button support
function makeDraggable(element: HTMLElement, dragHandle: HTMLElement, pinButton?: HTMLElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let hasMoved = false;
    
    // Get the position of the mouse cursor, initialize drag sequence
    dragHandle.onmousedown = dragMouseDown;
    
    function dragMouseDown(e: MouseEvent) {
        // Don't start drag if we're clicking on a button or other interactive element
        if ((e.target as HTMLElement).tagName === 'BUTTON' || 
            (e.target as HTMLElement).closest('button') ||
            (e.target as HTMLElement).tagName === 'svg' || 
            (e.target as HTMLElement).tagName === 'path') {
            return;
        }
        
        e.preventDefault();
        
        // Get the mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Add event listeners for drag events
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e: MouseEvent) {
        e.preventDefault();
        
        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Always convert to fixed positioning if it's not already
        if (element.style.position !== 'fixed') {
            const rect = element.getBoundingClientRect();
            element.style.top = rect.top + "px";
            element.style.left = rect.left + "px";
            element.style.bottom = 'auto';
            element.style.right = 'auto';
            element.style.position = 'fixed';
        }
        
        // Calculate new viewport-relative position (fixed positioning)
        const newTop = element.offsetTop - pos2;
        const newLeft = element.offsetLeft - pos1;
        
        // Ensure the element stays within viewport bounds
        const maxLeft = window.innerWidth - element.offsetWidth;
        const maxTop = window.innerHeight - element.offsetHeight;
        
        // Apply new position with bounds checking
        element.style.top = Math.min(Math.max(0, newTop), maxTop) + "px";
        element.style.left = Math.min(Math.max(0, newLeft), maxLeft) + "px";
        
        // Mark as moved and activate pin button
        if (!hasMoved) {
            hasMoved = true;
            
            // Activate pin button after movement (if provided)
            if (pinButton && !pinButton.classList.contains('active')) {
                pinButton.style.opacity = '1';
                pinButton.style.cursor = 'pointer';
                pinButton.style.pointerEvents = 'auto';
                pinButton.querySelector('svg')?.setAttribute('fill', '#555');
                pinButton.classList.add('active'); // Mark as activated
            }
        }
    }
    
    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
    
    // No scroll handler needed for fixed positioning as it stays in position
    
    // Clean up when element is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const node of Array.from(mutation.removedNodes)) {
                    if (node === element) {
                        observer.disconnect();
                    }
                }
            }
        });
    });
    
    observer.observe(document.body, { childList: true });
    
    // If we have a pin button, set up its click handler here
    if (pinButton) {
        pinButton.addEventListener('click', function() {
            // Only respond if the button is active (meaning we've moved)
            if (this.classList.contains('active')) {
                // Reset to original position (fixed bottom-right)
                element.style.position = 'fixed';
                element.style.top = 'auto';
                element.style.left = 'auto';
                element.style.bottom = '20px';
                element.style.right = '20px';
                
                // Reset the pin button state
                this.style.opacity = '0.5';
                this.style.cursor = 'default';
                this.style.pointerEvents = 'none';
                this.querySelector('svg')?.setAttribute('fill', '#aaa');
                this.classList.remove('active');
                
                // Reset the moved state
                hasMoved = false;
            }
        });
    }
}

// New function to adjust the overlay's height based on content
function adjustOverlayHeight() {
    const overlay = document.querySelector('.yt-summarizer-overlay') as HTMLElement;
    const content = document.querySelector('.yt-summarizer-content') as HTMLElement;
    const header = overlay?.querySelector('div') as HTMLElement; // First div is the header
    
    if (!overlay || !content || !header) return;
    
    // If the content is not displayed (minimized), don't adjust the height
    if (content.style.display === 'none') {
        return;
    }
    
    // Get the actual content height
    const contentHeight = content.scrollHeight;
    
    // Get header height
    const headerHeight = header.offsetHeight;
    
    // Calculate the total desired height with some padding
    const padding = 30;
    const desiredHeight = contentHeight + headerHeight + padding;
    
    // Set limits
    const minHeight = 100;
    const maxHeight = 600;
    
    // Apply the calculated height within constraints
    const newHeight = Math.min(Math.max(desiredHeight, minHeight), maxHeight);
    overlay.style.height = `${newHeight}px`;
    
    // Only show scrollbar if needed
    content.style.overflowY = contentHeight > (newHeight - headerHeight - padding) ? 'auto' : 'hidden';
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
        
        // Adjust container height based on content
        setTimeout(() => adjustOverlayHeight(), 10);
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
        
        // Adjust container height based on content
        setTimeout(() => adjustOverlayHeight(), 10);
    } catch (error) {
        // console.error('Error rendering markdown:', error);
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
                // console.error('Failed to copy markdown:', err);
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
                    // console.error('Could not copy text: ', err);
                });
        }
    });
    return copyBtn;
}

// Function to add resize handles to the overlay
function addResizeHandles(element: HTMLElement) {
    // Define positions for the resize handles
    const positions = [
        'top', 'right', 'bottom', 'left',
        'top-left', 'top-right', 'bottom-left', 'bottom-right'
    ];
    
    // Minimum dimensions
    const minWidth = 350;
    const minHeight = 100;
    
    // Maximum dimensions
    const maxWidth = 800;
    const maxHeight = 600;
    
    // Create and append resize handles
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `yt-summarizer-resize-handle ${pos}`;
        
        // Set appropriate cursor and position for each handle
        let cursor = pos.includes('-') ? 
            `${pos.replace('-', '')}-resize` : 
            `${pos}-resize`;
            
        // Special case for left/right and top/bottom
        if (pos === 'left' || pos === 'right') cursor = 'ew-resize';
        if (pos === 'top' || pos === 'bottom') cursor = 'ns-resize';
        
        // Style the handle
        handle.style.cssText = `
            position: absolute;
            z-index: 10000;
            background-color: transparent;
            ${getHandlePositionStyle(pos)}
            cursor: ${cursor};
        `;
        
        // Add mousedown event listener to initiate resizing
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Initial coordinates
            const startX = e.clientX;
            const startY = e.clientY;
            
            // Initial element dimensions and position
            const startWidth = element.offsetWidth;
            const startHeight = element.offsetHeight;
            
            // Convert rect coordinates to match fixed positioning
            let startLeft = element.getBoundingClientRect().left;
            let startTop = element.getBoundingClientRect().top;
            
            // If we're not using fixed positioning, convert to fixed
            if (element.style.position !== 'fixed') {
                element.style.position = 'fixed';
                element.style.top = startTop + "px";
                element.style.left = startLeft + "px";
                element.style.bottom = 'auto';
                element.style.right = 'auto';
            }
            
            // Function to handle the resizing
            function onMouseMove(e: MouseEvent) {
                // Calculate the distance moved
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Update dimensions based on the direction
                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;
                
                // Handle resizing based on position
                if (pos.includes('right')) {
                    newWidth = startWidth + dx;
                    newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
                }
                
                if (pos.includes('bottom')) {
                    newHeight = startHeight + dy;
                    newHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
                }
                
                if (pos.includes('left')) {
                    const deltaWidth = Math.min(Math.max(startWidth - dx, minWidth), maxWidth);
                    newLeft = startLeft + (startWidth - deltaWidth);
                    newWidth = deltaWidth;
                }
                
                if (pos.includes('top')) {
                    const deltaHeight = Math.min(Math.max(startHeight - dy, minHeight), maxHeight);
                    newTop = startTop + (startHeight - deltaHeight);
                    newHeight = deltaHeight;
                }
                
                // Apply new dimensions and position
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
                
                // Ensure content scrolling works properly
                const content = element.querySelector('.yt-summarizer-content') as HTMLElement;
                if (content) {
                    const header = element.querySelector('div') as HTMLElement; // First div is the header
                    if (header) {
                        const contentHeight = newHeight - header.offsetHeight;
                        content.style.height = `${contentHeight}px`;
                    }
                }
            }
            
            // Function to stop resizing
            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
            
            // Add events to document to handle dragging outside the element
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        element.appendChild(handle);
    });
}

// Helper function to get CSS positioning for each handle
function getHandlePositionStyle(pos: string): string {
    const handleSize = '10px';  // Size of the handle area
    const edgeSize = '8px';     // Size of the corner handles
    
    switch (pos) {
        case 'top':
            return `top: 0; left: ${handleSize}; right: ${handleSize}; height: ${handleSize}; cursor: ns-resize;`;
        case 'right':
            return `top: ${handleSize}; right: 0; bottom: ${handleSize}; width: ${handleSize}; cursor: ew-resize;`;
        case 'bottom':
            return `bottom: 0; left: ${handleSize}; right: ${handleSize}; height: ${handleSize}; cursor: ns-resize;`;
        case 'left':
            return `top: ${handleSize}; left: 0; bottom: ${handleSize}; width: ${handleSize}; cursor: ew-resize;`;
        case 'top-left':
            return `top: 0; left: 0; width: ${edgeSize}; height: ${edgeSize}; cursor: nwse-resize;`;
        case 'top-right':
            return `top: 0; right: 0; width: ${edgeSize}; height: ${edgeSize}; cursor: nesw-resize;`;
        case 'bottom-left':
            return `bottom: 0; left: 0; width: ${edgeSize}; height: ${edgeSize}; cursor: nesw-resize;`;
        case 'bottom-right':
            return `bottom: 0; right: 0; width: ${edgeSize}; height: ${edgeSize}; cursor: nwse-resize;`;
        default:
            return '';
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

// Listen for messages from background script with proper error handling
chrome.runtime.onMessage.addListener((message) => {
    try {
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
                updateMarkdownOverlay(currentMarkdown).catch(err => {
                    // console.error('Error updating markdown overlay:', err);
                });
            }
        }
        
        if (message.action === 'summaryComplete') {
            // Mark generation as complete
            const stateKey = window.location.href;
            generationState.set(stateKey, false);
            
            // Update button visibility
            updateRegenerateButtonVisibility();
            
            // Final height adjustment after a small delay to ensure content is fully rendered
            setTimeout(() => {
                // Only adjust height if the content is visible (not minimized)
                const content = document.querySelector('.yt-summarizer-content') as HTMLElement | null;
                if (content && content.style.display !== 'none') {
                    adjustOverlayHeight();
                }
            }, 100);
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
    } catch (err) {
        // console.error('Error processing message from background script:', err);
    }
    
    // Always return true (acknowledge receipt) to prevent channel closing errors
    return true;
});
