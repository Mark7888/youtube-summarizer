# YouTube Summarizer

A Chrome extension that automatically summarizes YouTube videos by analyzing their transcript/captions using OpenAI's language models.

## Features

- **One-Click Summaries**: Adds a "Summarize" button directly to the YouTube video player interface
- **AI-Powered**: Uses OpenAI's powerful models (like GPT-4o-mini by default) to generate concise summaries
- **View Original Transcript**: Access the complete transcript without leaving YouTube
- **Chat Interface**: Engage in a conversation about the video content with the AI
- **Markdown Support**: Displays summaries with proper formatting (headings, bullet points, etc.)
- **Customizable**: Choose different AI models and customize the system prompt
- **Language Selection**: Choose from available transcript languages for videos with multiple language options
- **Resizable Summary Window**: Adjust the summary overlay to your preferred size
- **Draggable Summary Window**: Move the summary overlay anywhere on the screen
- **Minimizable Window**: Minimize the summary overlay to keep it out of the way when not needed
- **Copy Functionality**: Easily copy summaries to your clipboard
- **Regenerate Option**: Get a new summary with a single click if needed

## How It Works

The extension:
1. Extracts the transcript from the YouTube video
2. Sends the transcript to OpenAI's API
3. Displays a nicely formatted summary directly on the YouTube page
4. Allows you to copy, regenerate, or dismiss the summary

## Installation

You can install YouTube Summarizer in two ways:

### Option 1: Download and Load Unpacked Extension

1. Download the latest release [here](https://github.com/Mark7888/youtube-summarizer/releases) (when available)
2. Unzip the downloaded file to a location on your computer
3. Open Chrome and navigate to `chrome://extensions`
4. Enable "Developer mode" by toggling the switch in the top-right corner
5. Click "Load unpacked" and select the unzipped folder
6. The extension should now be installed and visible in your Chrome toolbar

### Option 2: Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or newer)
- [Yarn](https://yarnpkg.com/getting-started/install) package manager
- Git (optional, for cloning the repository)

#### Steps

1. Clone or download the repository:
   ```bash
   git clone https://github.com/Mark7888/youtube-summarizer.git
   # or download and extract the ZIP file from GitHub
   ```

2. Navigate to the project directory:
   ```bash
   cd youtube-summarizer
   ```

3. Install dependencies:
   ```bash
   yarn install
   ```

4. Build the extension:
   ```bash
   yarn build
   ```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" by toggling the switch in the top-right corner
   - Click "Load unpacked"
   - Select the `dist` folder that was created in the project directory

For more detailed instructions on loading unpacked extensions, see the [Chrome Developer documentation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Setting Up Your OpenAI API Key

### Why Do You Need an API Key?

YouTube Summarizer uses OpenAI's API to generate high-quality summaries of video content. Since these API calls incur costs, OpenAI requires each user to use their own API key. This ensures:

- You have control over your own API usage
- Your summaries are generated using your own account
- The extension doesn't need a backend server

### How to Get an API Key

1. Go to [OpenAI's Platform website](https://platform.openai.com/api-keys)
2. Create an account or log in if you already have one
3. Navigate to the API Keys section
4. Click "Create new secret key" and give it a name (e.g., "YouTube Summarizer")
5. Copy your new API key (you won't be able to see it again)

### Adding Your API Key to the Extension

1. Click the YouTube Summarizer icon in your Chrome toolbar to open the settings
2. Paste your API key in the "OpenAI API Key" field
3. Click "Save Settings"

Alternatively, the extension will prompt you to enter your API key when you first try to summarize a video.

## Usage

1. Navigate to any YouTube video with available captions/transcript
2. Click the "Summarize" button that appears next to the Like/Dislike buttons
3. If the video has multiple language options for transcripts, you can select your preferred language from the dropdown menu
4. Wait a moment while the extension processes the transcript
5. Read the summary in the popup window that appears
6. Use the tabs at the top to switch between:
   - **Summary**: AI-generated summary of the video
   - **Transcript**: Complete transcript of the video
   - **Conversation**: Chat about the video content

### Customization Options

In the extension settings, you can:
- Change the AI model being used (e.g., GPT-4o, GPT-4, etc.)
- Customize the system prompt to change how summaries are generated
- Enter a custom model name if you want to use a different model

## Future Plans

We're constantly working to improve YouTube Summarizer. Here are some features we're planning to add:

- **Summary customization**: Choose between brief, detailed, or bullet-point summaries
- **Multilingual support**: Get summaries in different languages
- **Timestamps**: Include important timestamps in the summary, allowing to jump directly to that part of the video by clicking on them
- **Theme options**: Light and dark mode for the summary overlay
- **Add more AI models**: Support for more model providers
- **Firefox support**: Port the extension to Firefox
- **Advanced language preferences**: Set your preferred default language for transcripts

## Privacy

YouTube Summarizer sends video transcripts to OpenAI's API using your personal API key. No data is stored on any server except during the processing of your request with OpenAI. The extension operates entirely in your browser and only accesses YouTube video transcripts when you explicitly click the "Summarize" button.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests on our [GitHub repository](https://github.com/Mark7888/youtube-summarizer).

## License

This project is licensed under the MIT License - see the LICENSE file for details.
