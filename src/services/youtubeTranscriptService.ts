import { YoutubeTranscript } from 'youtube-transcript';

export interface TranscriptResult {
    success: boolean;
    transcript?: string;
    error?: string;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Fetch transcript for a YouTube video
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        const fullTranscript = transcript.map(part => part.text).join(' ');

        if (fullTranscript.length === 0) {
            return {
                success: false,
                error: 'No transcript available for this video'
            };
        }

        return {
            success: true,
            transcript: fullTranscript
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch transcript'
        };
    }
}
