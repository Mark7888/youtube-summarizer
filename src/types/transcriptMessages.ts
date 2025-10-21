export interface FetchTranscriptMessage {
    type: 'FETCH_TRANSCRIPT';
    videoId: string;
    lang?: string;
}

export interface GetLanguagesMessage {
    type: 'GET_LANGUAGES';
    videoId: string;
}

export interface TranscriptSuccessResponse {
    success: true;
    data: any;
}

export interface TranscriptErrorResponse {
    success: false;
    error: string;
    errorType?: string;
}

export type TranscriptResponse = TranscriptSuccessResponse | TranscriptErrorResponse;

export type TranscriptMessage = FetchTranscriptMessage | GetLanguagesMessage;
