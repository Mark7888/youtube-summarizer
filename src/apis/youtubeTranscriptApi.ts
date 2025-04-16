const RE_YOUTUBE =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)';
const RE_XML_TRANSCRIPT =
    /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

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
    forceReload?: boolean; // Added forceReload option
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
    baseUrl: string;
}

export interface TranscriptCache {
    videoId: string;
    transcripts: TranscriptResponse[];
    lang: string;
    availableLanguages: CaptionTrack[];
}

/**
 * Class to retrieve transcript if exist
 */
export class YoutubeTranscript {
    // Cache to store the last loaded transcript
    private static transcriptCache: TranscriptCache | null = null;

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
        
        // Check if we can use the cache
        if (
            !config?.forceReload && 
            this.transcriptCache && 
            this.transcriptCache.videoId === identifier &&
            (!config?.lang || this.transcriptCache.lang === config.lang)
        ) {
            return this.transcriptCache.transcripts;
        }

        const videoPageResponse = await fetch(
            `https://www.youtube.com/watch?v=${identifier}`,
            {
                headers: {
                    ...(config?.lang && { 'Accept-Language': config.lang }),
                    'User-Agent': USER_AGENT,
                },
            }
        );
        const videoPageBody = await videoPageResponse.text();

        const splittedHTML = videoPageBody.split('"captions":');

        if (splittedHTML.length <= 1) {
            if (videoPageBody.includes('class="g-recaptcha"')) {
                throw new YoutubeTranscriptTooManyRequestError();
            }
            if (!videoPageBody.includes('"playabilityStatus":')) {
                throw new YoutubeTranscriptVideoUnavailableError(videoId);
            }
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        const captions = (() => {
            try {
                return JSON.parse(
                    splittedHTML[1].split(',"videoDetails')[0].replace('\n', '')
                );
            } catch (e) {
                return undefined;
            }
        })()?.['playerCaptionsTracklistRenderer'];

        if (!captions) {
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        if (!('captionTracks' in captions)) {
            throw new YoutubeTranscriptNotAvailableError(videoId);
        }

        const captionTracks: CaptionTrack[] = captions.captionTracks;

        if (
            config?.lang &&
            !captionTracks.some(
                (track: CaptionTrack) => track.languageCode === config?.lang
            )
        ) {
            throw new YoutubeTranscriptNotAvailableLanguageError(
                config?.lang,
                captionTracks.map((track: CaptionTrack) => track.languageCode),
                videoId
            );
        }

        const selectedTrack: CaptionTrack = (
            config?.lang
                ? captionTracks.find(
                    (track: CaptionTrack) => track.languageCode === config?.lang
                )
                : captionTracks[0]
        ) as CaptionTrack;

        const transcriptURL: string = selectedTrack.baseUrl;

        const transcriptResponse = await fetch(transcriptURL, {
            headers: {
                ...(config?.lang && { 'Accept-Language': config.lang }),
                'User-Agent': USER_AGENT,
            },
        });
        if (!transcriptResponse.ok) {
            throw new YoutubeTranscriptNotAvailableError(videoId);
        }
        const transcriptBody = await transcriptResponse.text();
        const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
        
        const transcripts = results.map((result) => ({
            text: result[3],
            duration: parseFloat(result[2]),
            offset: parseFloat(result[1]),
            lang: selectedTrack.languageCode,
        }));

        // Store in cache
        this.transcriptCache = {
            videoId: identifier,
            transcripts: transcripts,
            lang: selectedTrack.languageCode,
            availableLanguages: captionTracks
        };
        
        return transcripts;
    }

    /**
     * Get available languages for a video
     * @param videoId Video url or video identifier
     * @param forceReload Whether to force a reload of the data
     */
    public static async getLanguages(videoId: string, forceReload: boolean = false): Promise<CaptionTrack[]> {
        const identifier = this.retrieveVideoId(videoId);
        
        // Check if we can use the cache
        if (
            !forceReload && 
            this.transcriptCache && 
            this.transcriptCache.videoId === identifier
        ) {
            return this.transcriptCache.availableLanguages;
        }
        
        // Otherwise, we need to fetch the video page
        const videoPageResponse = await fetch(
            `https://www.youtube.com/watch?v=${identifier}`,
            {
                headers: {
                    'User-Agent': USER_AGENT,
                },
            }
        );
        const videoPageBody = await videoPageResponse.text();

        const splittedHTML = videoPageBody.split('"captions":');

        if (splittedHTML.length <= 1) {
            if (videoPageBody.includes('class="g-recaptcha"')) {
                throw new YoutubeTranscriptTooManyRequestError();
            }
            if (!videoPageBody.includes('"playabilityStatus":')) {
                throw new YoutubeTranscriptVideoUnavailableError(videoId);
            }
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        const captions = (() => {
            try {
                return JSON.parse(
                    splittedHTML[1].split(',"videoDetails')[0].replace('\n', '')
                );
            } catch (e) {
                return undefined;
            }
        })()?.['playerCaptionsTracklistRenderer'];

        if (!captions) {
            throw new YoutubeTranscriptDisabledError(videoId);
        }

        if (!('captionTracks' in captions)) {
            throw new YoutubeTranscriptNotAvailableError(videoId);
        }
        
        // Store available languages in cache, without loading any transcript
        const captionTracks: CaptionTrack[] = captions.captionTracks;
        
        if (!this.transcriptCache) {
            this.transcriptCache = {
                videoId: identifier,
                transcripts: [],
                lang: '',
                availableLanguages: captionTracks
            };
        } else {
            this.transcriptCache.videoId = identifier;
            this.transcriptCache.availableLanguages = captionTracks;
        }
        
        return captionTracks;
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