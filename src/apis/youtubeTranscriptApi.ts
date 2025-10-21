const RE_YOUTUBE =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

export class YoutubeTranscriptError extends Error {
    constructor(message: string) {
        super(`[YoutubeTranscript] 🚨 ${message}`);
    }
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
    constructor() {
        super(
            'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue'
        );
    }
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
    constructor(videoId: string) {
        super(`The video is no longer available (${videoId})`);
    }
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
    constructor(videoId: string) {
        super(`Transcript is disabled on this video (${videoId})`);
    }
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
    constructor(videoId: string) {
        super(`No transcripts are available for this video (${videoId})`);
    }
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
    constructor(lang: string, availableLangs: string[], videoId: string) {
        super(
            `No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
                ', '
            )}`
        );
    }
}

export interface TranscriptConfig {
    lang?: string;
    forceReload?: boolean;
}

export interface TranscriptResponse {
    text: string;
    duration: number;
    offset: number;
    lang?: string;
}

export interface CaptionTrack {
    languageCode: string;
    name?: {
        simpleText: string;
    };
    baseUrl?: string;
    url?: string;
    kind?: string;
}

export interface TranscriptCache {
    videoId: string;
    transcripts: TranscriptResponse[];
    lang: string;
    availableLanguages: CaptionTrack[];
}

/**
 * Class to retrieve transcript if exist
 * This is a background-side wrapper that communicates with content scripts
 */
export class YoutubeTranscript {
    private static transcriptCache: TranscriptCache | null = null;

    /**
     * Find the YouTube tab to send messages to
     */
    private static async findYoutubeTab(videoId: string): Promise<number> {
        const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
        
        // Prefer tab with matching video
        for (const tab of tabs) {
            if (tab.id && tab.url?.includes(videoId)) {
                return tab.id;
            }
        }
        
        // Fallback to any YouTube tab
        if (tabs.length > 0 && tabs[0].id) {
            return tabs[0].id;
        }
        
        throw new YoutubeTranscriptError('No YouTube tab found. Please open YouTube.');
    }

    /**
     * Send message to content script and wait for response
     */
    private static async sendMessageToContent<T>(tabId: number, message: any): Promise<T> {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response: any) => {
                if (chrome.runtime.lastError) {
                    reject(new YoutubeTranscriptError(
                        `Failed to communicate with YouTube page: ${chrome.runtime.lastError.message}`
                    ));
                    return;
                }
                
                if (!response) {
                    reject(new YoutubeTranscriptError('No response from content script'));
                    return;
                }
                
                if (!response.success) {
                    // Parse error type and throw appropriate error
                    const errorType = response.errorType || '';
                    const videoId = message.videoId;
                    
                    if (errorType === 'NO_TRANSCRIPTS_AVAILABLE') {
                        reject(new YoutubeTranscriptNotAvailableError(videoId));
                    } else if (errorType.startsWith('LANGUAGE_NOT_AVAILABLE')) {
                        const lang = errorType.split(':')[1] || message.lang;
                        reject(new YoutubeTranscriptNotAvailableLanguageError(
                            lang,
                            [],
                            videoId
                        ));
                    } else {
                        reject(new YoutubeTranscriptError(response.error || 'Unknown error'));
                    }
                    return;
                }
                
                resolve(response.data);
            });
        });
    }

    /**
     * Fetch transcript from YTB Video
     * @param videoId Video url or video identifier
     * @param config Get transcript in a specific language ISO and control cache usage
     */
    public static async fetchTranscript(
        videoId: string,
        config?: TranscriptConfig
    ): Promise<TranscriptResponse[]> {
        const identifier = this.retrieveVideoId(videoId);
        
        // Check cache
        if (
            !config?.forceReload && 
            this.transcriptCache && 
            this.transcriptCache.videoId === identifier &&
            (!config?.lang || this.transcriptCache.lang === config.lang)
        ) {
            return this.transcriptCache.transcripts;
        }

        try {
            // Find YouTube tab
            const tabId = await this.findYoutubeTab(identifier);
            
            // Send message to content script
            const transcripts = await this.sendMessageToContent<TranscriptResponse[]>(
                tabId,
                {
                    type: 'FETCH_TRANSCRIPT',
                    videoId: identifier,
                    lang: config?.lang
                }
            );
            
            // Update cache
            this.transcriptCache = {
                videoId: identifier,
                transcripts: transcripts,
                lang: transcripts[0]?.lang || config?.lang || '',
                availableLanguages: []
            };
            
            return transcripts;
        } catch (error) {
            if (error instanceof YoutubeTranscriptError) {
                throw error;
            }
            throw new YoutubeTranscriptError(
                error instanceof Error ? error.message : 'Unknown error occurred'
            );
        }
    }

    /**
     * Get available languages for a video
     * @param videoId Video url or video identifier
     * @param forceReload Whether to force a reload of the data
     */
    public static async getLanguages(videoId: string, forceReload: boolean = false): Promise<CaptionTrack[]> {
        const identifier = this.retrieveVideoId(videoId);
        
        // Check cache
        if (
            !forceReload && 
            this.transcriptCache && 
            this.transcriptCache.videoId === identifier &&
            this.transcriptCache.availableLanguages.length > 0
        ) {
            return this.transcriptCache.availableLanguages;
        }
        
        try {
            // Find YouTube tab
            const tabId = await this.findYoutubeTab(identifier);
            
            // Send message to content script
            const languages = await this.sendMessageToContent<CaptionTrack[]>(
                tabId,
                {
                    type: 'GET_LANGUAGES',
                    videoId: identifier
                }
            );
            
            // Update cache
            if (!this.transcriptCache || this.transcriptCache.videoId !== identifier) {
                this.transcriptCache = {
                    videoId: identifier,
                    transcripts: [],
                    lang: '',
                    availableLanguages: languages
                };
            } else {
                this.transcriptCache.availableLanguages = languages;
            }
            
            return languages;
        } catch (error) {
            if (error instanceof YoutubeTranscriptError) {
                throw error;
            }
            throw new YoutubeTranscriptError(
                error instanceof Error ? error.message : 'Unknown error occurred'
            );
        }
    }

    /**
     * Retrieve video id from url or string
     * @param videoId video url or video id
     */
    public static retrieveVideoId(videoId: string) {
        if (videoId.length === 11) {
            return videoId;
        }
        const matchId = videoId.match(RE_YOUTUBE);
        if (matchId && matchId.length) {
            return matchId[1];
        }
        throw new YoutubeTranscriptError(
            'Impossible to retrieve Youtube video ID.'
        );
    }
}
