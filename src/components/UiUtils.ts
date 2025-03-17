// UI utility functions for dragging, resizing and height adjustment

// Function to make an element draggable with pin button support
export function makeDraggable(element: HTMLElement, dragHandle: HTMLElement, pinButton?: HTMLElement): void {
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

// Function to add resize handles to the overlay
export function addResizeHandles(element: HTMLElement): void {
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

// New function to adjust the overlay's height based on content
export function adjustOverlayHeight(): void {
    const overlay = document.querySelector('.yt-summarizer-overlay') as HTMLElement;
    const header = overlay?.querySelector('div:first-child') as HTMLElement;
    const tabsRow = document.querySelector('.yt-summarizer-tabs') as HTMLElement;
    
    if (!overlay || !header || !tabsRow) return;
    
    // Get the currently active tab type from the DOM
    const activeTabElement = document.querySelector('.yt-summarizer-tab.active') as HTMLElement;
    if (!activeTabElement) return;
    
    const tabType = activeTabElement.dataset.tabType;
    if (!tabType) return;
    
    const activeContent = document.querySelector(`.yt-summarizer-${tabType}`) as HTMLElement;
    if (!activeContent) return;
    
    // If the content is not displayed (minimized), don't adjust the height
    if (activeContent.style.display === 'none') {
        return;
    }
    
    // Get the actual content height
    const contentHeight = activeContent.scrollHeight;
    
    // Get header height
    const headerHeight = header.offsetHeight;
    
    // Get tabs row height
    const tabsRowHeight = tabsRow.offsetHeight;
    
    // Calculate the total desired height with some padding
    const padding = 30;
    const desiredHeight = contentHeight + headerHeight + tabsRowHeight + padding;
    
    // Set limits
    const minHeight = 150; // Increased minimum height
    const maxHeight = 600;
    
    // Apply the calculated height within constraints
    const newHeight = Math.min(Math.max(desiredHeight, minHeight), maxHeight);
    overlay.style.height = `${newHeight}px`;
    
    // Set container height to fill available space
    const contentContainer = document.querySelector('.yt-summarizer-content-container') as HTMLElement;
    if (contentContainer) {
        const availableHeight = newHeight - headerHeight - tabsRowHeight;
        contentContainer.style.height = `${availableHeight}px`;
    }
    
    // Ensure content areas have proper scrolling settings
    const contentAreas = document.querySelectorAll('.yt-summarizer-content');
    contentAreas.forEach(element => {
        // Only show scrollbar if needed
        const el = element as HTMLElement;
        const shouldScroll = el.scrollHeight > (newHeight - headerHeight - tabsRowHeight);
        el.style.overflowY = shouldScroll ? 'auto' : 'hidden';
    });
}
