import { 
    YoutubeTranscript, 
    TranscriptResponse, 
    CaptionTrack, 
    YoutubeTranscriptError 
} from '../apis/youtubeTranscriptApi';

export interface LanguageOption {
    code: string;
    name: string;
}

export interface TranscriptResult {
    success: boolean;
    transcript?: string;
    language?: string;
    vssId?: string; // Track identifier used
    error?: string;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
    try {
        return YoutubeTranscript.retrieveVideoId(url);
    } catch (error) {
        console.error('Failed to extract video ID:', error);
        return null;
    }
}

/**
 * Fetch transcript for a YouTube video with optional language
 */
export async function fetchTranscript(videoId: string, language?: string): Promise<TranscriptResult> {
    try {
        // Fetch transcript with specified language if provided
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: language,
            forceReload: true // Always reload when language might have changed
        });
        
        // Process transcript into a string
        const transcriptText = processTranscriptToText(transcriptData);
        
        // Return success with transcript, language, and vssId
        return {
            success: true,
            transcript: transcriptText,
            language: transcriptData[0]?.lang, // Return the actual language used
            vssId: transcriptData[0]?.vssId // Return the actual track identifier
        };
    } catch (error) {
        console.error('Failed to fetch transcript:', error);
        return {
            success: false,
            error: error instanceof YoutubeTranscriptError 
                ? error.message 
                : 'Failed to retrieve transcript'
        };
    }
}

/**
 * Get available languages for a video
 */
export async function getAvailableLanguages(videoId: string): Promise<LanguageOption[]> {
    try {
        const languages = await YoutubeTranscript.getLanguages(videoId, true);
        return languages.map(track => ({
            code: track.languageCode,
            name: track.name?.simpleText || track.languageCode
        }));
    } catch (error) {
        console.error('Failed to get available languages:', error);
        return [];
    }
}

/**
 * Convert transcript data to readable text
 */
function processTranscriptToText(transcriptData: TranscriptResponse[]): string {
    return transcriptData
        .map(item => item.text.trim())
        .join(' ')
        .replace(/\s+/g, ' ');
}
