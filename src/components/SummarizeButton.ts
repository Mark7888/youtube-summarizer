import { startSummarization } from './SummaryController';
import { showApiKeyPrompt } from './ApiKeyPrompt';

// Function to add a summarize button to YouTube's interface
export function addSummarizeButton(): void {
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
                    setupIconReplacement(iconElement);
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

// Helper function to set up the icon replacement
function setupIconReplacement(iconElement: Element): void {
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
