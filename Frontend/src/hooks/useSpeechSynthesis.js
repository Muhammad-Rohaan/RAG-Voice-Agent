import { useState, useEffect, useRef, useCallback } from 'react';

const RAG_BASE_URL = import.meta.env.VITE_RAG_API_BASE_URL ?? 'http://localhost:9000';

/**
 * Polls the given URL until the audio file is ready (non-empty, valid audio),
 * then returns a blob URL for safe cross-origin playback.
 *
 * Strategy:
 *   - Initial delay of 4 s to allow the background TTS generation to complete.
 *   - Up to 5 additional retry attempts with exponential backoff (2 s, 3 s, 4.5 s …).
 *   - Rejects only after all attempts are exhausted.
 */
async function pollForAudioBlob(url, { initialDelayMs = 4000, maxRetries = 5, baseDelayMs = 2000 } = {}) {
    // Give the server time to finish translation + TTS before the first fetch
    await new Promise(r => setTimeout(r, initialDelayMs));

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { cache: 'no-store' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} — audio not ready yet`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('audio')) {
                throw new Error(`Unexpected content-type: ${contentType}`);
            }

            const blob = await response.blob();
            if (blob.size < 2048) {
                throw new Error(`File too small (${blob.size} B) — generation still in progress`);
            }

            return URL.createObjectURL(blob);

        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(1.5, attempt);
                console.warn(
                    `[useSpeechSynthesis] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}. ` +
                    `Retrying in ${Math.round(delay / 1000)}s…`
                );
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw new Error(`Audio unavailable after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

export default function useSpeechSynthesis({ onStart, onEnd, onError } = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError]           = useState('');
    const audioRef     = useRef(null);
    const blobUrlRef   = useRef(null);
    const cancelledRef = useRef(false);

    const releaseBlobUrl = () => {
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
    };

    const cancel = useCallback(() => {
        cancelledRef.current = true;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
        releaseBlobUrl();
        setIsSpeaking(false);
    }, []);

    /**
     * speak(audioUrl?)
     *
     * Pass the `audioUrl` returned by the backend (e.g.
     * "https://akuh-voice-agent.onrender.com/speech.mp3").
     * Falls back to `${RAG_BASE_URL}/speech.mp3` if omitted.
     *
     * The function polls for the file (it may still be generating on the
     * server), creates a blob URL, and plays via HTMLAudioElement.
     */
    const speak = useCallback(async (audioUrl) => {
        cancel();
        cancelledRef.current = false;

        // Resolve the target URL — strip any stale query params, add fresh cache-buster
        let targetUrl;
        if (audioUrl && typeof audioUrl === 'string' && /^https?:\/\//.test(audioUrl)) {
            const base = audioUrl.split('?')[0];
            targetUrl = `${base}?t=${Date.now()}`;
        } else {
            targetUrl = `${RAG_BASE_URL}/speech.mp3?t=${Date.now()}`;
        }

        try {
            const blobUrl = await pollForAudioBlob(targetUrl);

            if (cancelledRef.current) {
                URL.revokeObjectURL(blobUrl);
                return;
            }

            blobUrlRef.current = blobUrl;
            const audio = new Audio(blobUrl);
            audioRef.current = audio;

            audio.onplay = () => {
                setIsSpeaking(true);
                setError('');
                if (onStart) onStart();
            };

            audio.onended = () => {
                setIsSpeaking(false);
                audioRef.current = null;
                releaseBlobUrl();
                if (onEnd) onEnd();
            };

            audio.onerror = (e) => {
                console.error('[useSpeechSynthesis] Playback error:', e);
                setIsSpeaking(false);
                audioRef.current = null;
                releaseBlobUrl();
                setError('Audio playback failed.');
                if (onError) onError('Audio playback failed.');
            };

            await audio.play();

        } catch (err) {
            if (cancelledRef.current) return;
            console.warn('[useSpeechSynthesis] Could not load audio:', err.message);
            // Don't show an error to the user — text is already displayed.
            // Just silently skip audio and call onEnd so the voice loop continues.
            setIsSpeaking(false);
            if (onEnd) onEnd();
        }
    }, [cancel, onStart, onEnd, onError]);

    useEffect(() => {
        return () => { cancel(); };
    }, [cancel]);

    return {
        isSpeaking,
        error,
        speak,
        cancel,
        isSupported: true,
    };
}
