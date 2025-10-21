/**
 * Content script side implementation of YouTube transcript fetching.
 * This runs in the context of the YouTube page and has access to make
 * same-origin requests to YouTube's Innertube API.
 */

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

export interface CaptionTrack {
    languageCode: string;
    name?: {
        simpleText: string;
    };
    baseUrl?: string;
    url?: string;
    kind?: string;
}

export interface TranscriptSegment {
    text: string;
    duration: number;
    offset: number;
    lang?: string;
}

export class YoutubeTranscriptContentFetcher {
    /**
     * Fetch YouTube API key from the current page
     */
    private static async fetchApiKey(): Promise<string> {
        const html = document.documentElement.outerHTML;
        
        const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || 
                            html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);
        
        if (!apiKeyMatch) {
            throw new Error('Could not find YouTube API key');
        }
        
        return apiKeyMatch[1];
    }

    /**
     * Call Innertube player API
     */
    private static async callPlayerApi(videoId: string, apiKey: string): Promise<any> {
        const playerEndpoint = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
        const playerBody = {
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '20.10.38',
                },
            },
            videoId: videoId,
        };
        
        const playerResponse = await fetch(playerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(playerBody),
        });
        
        if (!playerResponse.ok) {
            throw new Error(`Player API failed: ${playerResponse.status}`);
        }
        
        return await playerResponse.json();
    }

    /**
     * Extract caption tracks from player data
     */
    private static extractCaptionTracks(playerData: any): CaptionTrack[] {
        const tracklist = playerData?.captions?.playerCaptionsTracklistRenderer || 
                         playerData?.playerCaptionsTracklistRenderer;
        const tracks = tracklist?.captionTracks;
        
        if (!tracks || tracks.length === 0) {
            throw new Error('NO_TRANSCRIPTS_AVAILABLE');
        }
        
        return tracks;
    }

    /**
     * Get available languages for a video
     */
    public static async getLanguages(videoId: string): Promise<CaptionTrack[]> {
        try {
            const apiKey = await this.fetchApiKey();
            const playerData = await this.callPlayerApi(videoId, apiKey);
            return this.extractCaptionTracks(playerData);
        } catch (error: any) {
            throw new Error(error.message || 'Failed to get languages');
        }
    }

    /**
     * Fetch transcript for a video
     */
    public static async fetchTranscript(videoId: string, lang?: string): Promise<TranscriptSegment[]> {
        try {
            const apiKey = await this.fetchApiKey();
            const playerData = await this.callPlayerApi(videoId, apiKey);
            const captionTracks = this.extractCaptionTracks(playerData);
            
            // Select track based on language preference
            let selectedTrack: CaptionTrack;
            
            if (lang) {
                const track = captionTracks.find(t => t.languageCode === lang);
                if (!track) {
                    throw new Error(`LANGUAGE_NOT_AVAILABLE:${lang}`);
                }
                selectedTrack = track;
            } else {
                // Default to first track
                selectedTrack = captionTracks[0];
            }
            
            // Fetch transcript XML
            let transcriptURL = selectedTrack.baseUrl || selectedTrack.url || '';
            transcriptURL = transcriptURL.replace(/&fmt=[^&]+/, '');
            
            const transcriptResponse = await fetch(transcriptURL);
            if (!transcriptResponse.ok) {
                throw new Error('TRANSCRIPT_FETCH_FAILED');
            }
            
            const transcriptBody = await transcriptResponse.text();
            const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
            
            if (results.length === 0) {
                throw new Error('NO_TRANSCRIPT_TEXT');
            }
            
            return results.map((result) => ({
                text: result[3]
                    .replace(/&amp;#39;/g, "'")
                    .replace(/&amp;quot;/g, '"')
                    .replace(/&amp;amp;/g, '&')
                    .replace(/&#39;/g, "'")
                    .replace(/&quot;/g, '"'),
                duration: parseFloat(result[2]),
                offset: parseFloat(result[1]),
                lang: selectedTrack.languageCode,
            }));
        } catch (error: any) {
            throw new Error(error.message || 'Failed to fetch transcript');
        }
    }
}
