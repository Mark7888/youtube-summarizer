import { renderMarkdown, sanitizeHtml, createMarkdownStyles } from '../markdownRenderer';
import { TabType } from '../types';
import summaryTab from '../tabs/summaryTab';
import transcriptTab from '../tabs/transcriptTab';
import conversationTab from '../tabs/conversationTab';
import { generationState, markdownContent, startSummarization } from './SummaryController';
import { makeDraggable, addResizeHandles, adjustOverlayHeight } from './UiUtils';

// Track active tab
let activeTab: TabType = 'summary';

// Create and show the summary overlay with additional buttons
export function showSummaryOverlay(initialText: string = ''): void {
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
            tabsRow.style.display = 'flex';
            contentContainer.style.display = 'block';
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
            tabsRow.style.display = 'none';
            contentContainer.style.display = 'none';
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
    header.appendChild(headerRight);
    
    // Create tabs row
    const tabsRow = document.createElement('div');
    tabsRow.className = 'yt-summarizer-tabs';
    tabsRow.style.cssText = `
        display: flex;
        border-bottom: 1px solid #ddd;
    `;
    
    // Create tabs
    const tabs: {type: TabType, label: string}[] = [
        { type: 'summary', label: 'Summary' },
        { type: 'transcript', label: 'Transcript' },
        { type: 'conversation', label: 'Conversation' }
    ];
    
    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = `yt-summarizer-tab ${tab.type === activeTab ? 'active' : ''}`;
        tabEl.dataset.tabType = tab.type;
        tabEl.textContent = tab.label;
        tabEl.style.cssText = `
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            background-color: ${tab.type === activeTab ? '#eaeaea' : '#f9f9f9'};
            border-bottom: 2px solid ${tab.type === activeTab ? '#4285f4' : 'transparent'};
            transition: background-color 0.2s;
        `;
        
        tabEl.addEventListener('click', () => {
            switchTab(tab.type);
        });
        
        tabsRow.appendChild(tabEl);
    });
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'yt-summarizer-content-container';
    contentContainer.style.cssText = `
        flex-grow: 1;
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
    `;
    
    // Create individual content areas for each tab
    const tabContents: {[key in TabType]: HTMLElement} = {
        summary: document.createElement('div'),
        transcript: document.createElement('div'),
        conversation: document.createElement('div')
    };
    
    // Set up each content area
    Object.entries(tabContents).forEach(([type, element]) => {
        element.className = `yt-summarizer-content yt-summarizer-${type} markdown-body`;
        element.style.cssText = `
            padding: 15px;
            height: 100%;
            display: ${type === activeTab ? 'block' : 'none'};
            overflow-wrap: break-word;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch; /* Smoother scrolling on iOS */
            scrollbar-width: thin; /* For Firefox */
            box-sizing: border-box;
        `;
        
        // Add specific scroll handling to prevent stuck scrolling
        element.addEventListener('wheel', (e) => {
            const { scrollTop, scrollHeight, clientHeight } = element;
            
            // Allow scroll event to propagate naturally unless we're at the boundaries
            if ((scrollTop <= 0 && e.deltaY < 0) || 
                (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                e.preventDefault();
            }
        }, { passive: false });
        
        contentContainer.appendChild(element);
    });
    
    // Initialize tab handlers
    summaryTab.initialize(tabContents.summary);
    transcriptTab.initialize(tabContents.transcript);
    conversationTab.initialize(tabContents.conversation);
    
    // Set initial content
    if (initialText) {
        summaryTab.handleContent(initialText);
    }
    
    // Activate the current tab
    activateTab(activeTab);
    
    // Add markdown styles
    const styleEl = document.createElement('style');
    styleEl.textContent = createMarkdownStyles();
    document.head.appendChild(styleEl);
    
    // Add tab styles
    const tabStyles = document.createElement('style');
    tabStyles.textContent = `
        .yt-summarizer-tabs {
            display: flex;
            border-bottom: 1px solid #ddd;
        }
        
        .yt-summarizer-tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .yt-summarizer-tab:hover {
            background-color: #f0f0f0;
        }
        
        .yt-summarizer-tab.active {
            background-color: #eaeaea;
            border-bottom: 2px solid #4285f4;
        }
    `;
    document.head.appendChild(tabStyles);
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(tabsRow);
    overlay.appendChild(contentContainer);
    document.body.appendChild(overlay);
    
    // Add resize handles
    addResizeHandles(overlay);
    
    // Make the overlay draggable with pin functionality
    makeDraggable(overlay, header, pinBtn);
    
    // Update regenerate button visibility based on current state
    updateRegenerateButtonVisibility();
}

// Update the content of the summary overlay
export function updateSummaryOverlay(text: string, append: boolean = false): void {
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

// Update the overlay with markdown content
export async function updateMarkdownOverlay(markdownText: string): Promise<void> {
    const content = document.querySelector('.yt-summarizer-content') as HTMLElement;
    if (!content) return;
    
    try {
        // Render and sanitize markdown - handling async nature
        const html = await renderMarkdown(markdownText);
        const safeHtml = sanitizeHtml(html);
        
        // Update the content
        content.innerHTML = safeHtml;
        
        // Add bottom padding to ensure scrolling works properly
        const paddingElement = document.createElement('div');
        paddingElement.style.height = '20px';
        paddingElement.style.width = '100%';
        content.appendChild(paddingElement);
        
        // Adjust container height based on content
        setTimeout(() => adjustOverlayHeight(), 10);
    } catch (error) {
        content.textContent = markdownText;
    }
}

// Function to update regenerate button visibility
export function updateRegenerateButtonVisibility(): void {
    const regenerateBtn = document.querySelector('.yt-summarizer-regenerate-btn') as HTMLButtonElement;
    if (!regenerateBtn) return;
    
    const stateKey = window.location.href;
    const isGenerating = generationState.get(stateKey) === true;
    
    regenerateBtn.style.visibility = isGenerating ? 'hidden' : 'visible';
    regenerateBtn.disabled = isGenerating;
}

// Switch between tabs
export function switchTab(tabType: TabType): void {
    // Skip if already on this tab
    if (activeTab === tabType) return;
    
    // Update active tab state
    const prevTab = activeTab;
    activeTab = tabType;
    
    // Update tab styling
    const tabs = document.querySelectorAll('.yt-summarizer-tab');
    tabs.forEach(tab => {
        if ((tab as HTMLElement).dataset.tabType === tabType) {
            tab.classList.add('active');
            (tab as HTMLElement).style.backgroundColor = '#eaeaea';
            (tab as HTMLElement).style.borderBottom = '2px solid #4285f4';
        } else {
            tab.classList.remove('active');
            (tab as HTMLElement).style.backgroundColor = '#f9f9f9';
            (tab as HTMLElement).style.borderBottom = '2px solid transparent';
        }
    });
    
    // Deactivate previous tab handler
    if (prevTab === 'summary') summaryTab.deactivate();
    if (prevTab === 'transcript') transcriptTab.deactivate();
    if (prevTab === 'conversation') conversationTab.deactivate();
    
    // Activate new tab handler
    activateTab(tabType);
    
    // Adjust container height based on content
    setTimeout(() => adjustOverlayHeight(), 10);
}

// Activate a specific tab
function activateTab(tabType: TabType): void {
    if (tabType === 'summary') summaryTab.activate();
    if (tabType === 'transcript') transcriptTab.activate();
    if (tabType === 'conversation') conversationTab.activate();
}

// Function to handle copy button creation with tab-aware copying
function createCopyButton(): HTMLButtonElement {
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
        // Get content from the active tab handler
        let contentToCopy: string | null = null;
        
        // Get content based on active tab
        switch (activeTab) {
            case 'summary':
                contentToCopy = summaryTab.copyContent();
                break;
            case 'transcript':
                contentToCopy = transcriptTab.copyContent();
                break;
            case 'conversation':
                contentToCopy = conversationTab.copyContent();
                break;
        }
        
        // If we have content to copy, proceed
        if (contentToCopy) {
            navigator.clipboard.writeText(contentToCopy)
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
                    // Error handling
                });
        } else {
            // If no content is available, show a disabled state briefly
            const originalInnerHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24" fill="#999">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
                </svg>
            `;
            setTimeout(() => {
                copyBtn.innerHTML = originalInnerHTML;
            }, 1500);
        }
    });
    return copyBtn;
}
