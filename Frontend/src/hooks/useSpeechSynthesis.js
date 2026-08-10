import { useState, useEffect, useRef, useCallback } from 'react';

const RAG_BASE_URL = import.meta.env.VITE_RAG_API_BASE_URL ?? 'http://localhost:9000';

// Fetch the MP3 as a blob, with retries and exponential backoff.
// Returns a blob URL string on success, or throws after all retries fail.
async function fetchAudioBlob(url, maxRetries = 3, baseDelayMs = 1500) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('audio')) throw new Error(`Not audio: ${contentType}`);
            const blob = await response.blob();
            if (blob.size < 1024) throw new Error(`Audio file too small (${blob.size} bytes) — likely not ready yet`);
            return URL.createObjectURL(blob);
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(1.5, attempt);
                console.warn(`[useSpeechSynthesis] Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${Math.round(delay)}ms…`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

export default function useSpeechSynthesis({ onStart, onEnd, onError } = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState('');
    const audioRef = useRef(null);
    const blobUrlRef = useRef(null);
    const cancelledRef = useRef(false);   // prevents stale async continuations

    // Release any previously created blob URL to avoid memory leaks
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
     * speak(audioUrl)
     *
     * Fetches the MP3 at `audioUrl` (with retries), creates a blob URL,
     * and plays it via HTMLAudioElement.
     *
     * If no URL is provided the hook falls back to the RAG server's
     * canonical /speech.mp3 endpoint with a cache-buster.
     */
    const speak = useCallback(async (audioUrl) => {
        cancel();
        cancelledRef.current = false;   // reset for this new play session

        // Build the URL to fetch — always cache-bust so we get the latest file
        const timestamp = Date.now();
        let targetUrl;
        if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
            // Strip any existing query string, then add fresh cache buster
            const base = audioUrl.split('?')[0];
            targetUrl = `${base}?t=${timestamp}`;
        } else {
            targetUrl = `${RAG_BASE_URL}/speech.mp3?t=${timestamp}`;
        }

        try {
            // Fetch → blob (with retry on transient errors / not-ready-yet states)
            const blobUrl = await fetchAudioBlob(targetUrl);

            // If cancel() was called while we were fetching, bail out
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
            if (cancelledRef.current) return;   // intentional cancel, not an error
            console.error('[useSpeechSynthesis] Could not load audio:', err.message);
            setError('Could not load audio response.');
            if (onError) onError('Audio playback failed.');
        }
    }, [cancel, onStart, onEnd, onError]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            cancel();
        };
    }, [cancel]);

    return {
        isSpeaking,
        error,
        speak,
        cancel,
        isSupported: true,
    };
}
