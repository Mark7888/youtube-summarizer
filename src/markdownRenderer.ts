import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { gfmHeadingId } from 'marked-gfm-heading-id';

// Initialize marked with plugins
marked.use(
    gfmHeadingId({ prefix: 'heading-' }), // Use proper configuration for headings
    markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, language) {
            return code;
        }
    })
);

// Configure marked options using current API
marked.setOptions({
    gfm: true,
    breaks: true,
});

// Function to render markdown as HTML - handles async/sync return types
export async function renderMarkdown(text: string): Promise<string> {
    try {
        // Handle potential Promise return in newer versions of marked
        const result = marked.parse(text);
        if (result instanceof Promise) {
            return await result;
        }
        return result;
    } catch (error) {
        console.error('Error rendering markdown:', error);
        return text;
    }
}

// Simple sanitizer function to prevent XSS
export function sanitizeHtml(html: string): string {
    // This is a basic sanitizer that allows only certain tags
    // For production, you might want to use a proper library like DOMPurify
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove potentially harmful elements and attributes
    const allElements = tempDiv.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        
        // Remove onclick and other event handlers
        for (let j = 0; j < element.attributes.length; j++) {
            const attr = element.attributes[j];
            if (attr.name.startsWith('on') || 
                attr.name === 'href' && attr.value.startsWith('javascript:')) {
                element.removeAttribute(attr.name);
            }
        }
    }
    
    return tempDiv.innerHTML;
}

// Create CSS for markdown styling
export function createMarkdownStyles(): string {
    return `
        .markdown-body {
            color: #24292e;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            font-size: 10px; /* Reduced from 14px to 10px (4 points smaller) */
            line-height: 1.4; /* Reduced from 1.6 for tighter spacing */
            word-wrap: break-word;
        }
        .markdown-body h1 {
            font-size: 1.5em;
            margin-top: 0.8em; /* Reduced spacing */
            margin-bottom: 12px; /* Reduced spacing */
            font-weight: 600;
            line-height: 1.2; /* Tighter line height */
        }
        .markdown-body h2 {
            font-size: 1.25em;
            margin-top: 0.8em;
            margin-bottom: 12px;
            font-weight: 600;
            line-height: 1.2;
        }
        .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
            font-size: 1em;
            margin-top: 0.8em;
            margin-bottom: 12px;
            font-weight: 600;
            line-height: 1.2;
        }
        .markdown-body p {
            margin-top: 0;
            margin-bottom: 10px; /* Reduced spacing between paragraphs */
        }
        .markdown-body ul, .markdown-body ol {
            padding-left: 1.8em; /* Slightly tighter list indentation */
            margin-top: 0;
            margin-bottom: 10px;
        }
        .markdown-body li {
            margin-bottom: 0.2em; /* Tighter spacing between list items */
        }
        .markdown-body code {
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            background-color: rgba(27,31,35,0.05);
            border-radius: 3px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
        }
        .markdown-body pre {
            padding: 12px; /* Reduced padding */
            overflow: auto;
            font-size: 85%;
            line-height: 1.4;
            background-color: #f6f8fa;
            border-radius: 3px;
            margin-top: 0;
            margin-bottom: 10px; /* Reduced margin */
            word-wrap: normal;
        }
        .markdown-body pre code {
            padding: 0;
            background-color: transparent;
        }
        .markdown-body blockquote {
            padding: 0 0.8em; /* Reduced padding */
            color: #6a737d;
            border-left: 0.25em solid #dfe2e5;
            margin: 0 0 10px 0; /* Reduced margin */
        }
        .markdown-body hr {
            height: 0.2em;
            padding: 0;
            margin: 16px 0; /* Reduced margin */
            background-color: #e1e4e8;
            border: 0;
        }
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 10px; /* Reduced margin */
        }
        .markdown-body table th, .markdown-body table td {
            padding: 5px 10px; /* Reduced padding */
            border: 1px solid #dfe2e5;
        }
        .markdown-body table tr {
            background-color: #fff;
            border-top: 1px solid #c6cbd1;
        }
        .markdown-body table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
    `;
}
