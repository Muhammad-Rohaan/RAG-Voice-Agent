/** #################

// Realtime service: handles WebRTC connection, microphone, and event routing.
// Uses OpenAI's recommended WebRTC flow:
//  1. Get ephemeral token from backend
//  2. Create RTCPeerConnection
//  3. Add local mic track
//  4. Create SDP offer, POST to OpenAI to get SDP answer
//  5. Set remote description → connection established
//  6. Listen to data channel events for transcripts

// frontend/src/services/realtime.js

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";
// CHANGE THIS LINE:
const MODEL = "gpt-realtime"; 

export class RealtimeService {
  constructor({ onMessage, onStatusChange, onError }) {
    this.pc = null;
    this.dc = null;
    this.localStream = null;
    this.audioEl = null;

    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    // Track partial transcripts so we can update them live
    this.partialUserText = "";
    this.partialAiText = "";
  }

  async start() {
    try {
      this.onStatusChange("connecting");

      // 1. Get ephemeral token from our backend
      const res = await fetch("/session");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "Failed to get session");
      }
      const { client_secret } = await res.json();
      const token = client_secret.value;

      // 2. Create peer connection
      this.pc = new RTCPeerConnection();

      // 3. Microphone
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });

      // 4. Set up audio element to play remote (AI) audio
      this.audioEl = document.createElement("audio");
      this.audioEl.autoplay = true;
      this.pc.ontrack = (e) => {
        this.audioEl.srcObject = e.streams[0];
      };

      // 5. Data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      this.dc.addEventListener("message", (e) => this._handleEvent(e.data));

      // 6. SDP offer/answer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (faster connection)
      await this._waitForIceGathering();

      const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${MODEL}`, {
        method: "POST",
        body: this.pc.localDescription.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        throw new Error(`OpenAI SDP error ${sdpResponse.status}: ${text}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer = { type: "answer", sdp: answerSdp };
      await this.pc.setRemoteDescription(answer);

      this.onStatusChange("connected");
    } catch (err) {
      console.error("Realtime start error:", err);
      this.onError(err.message);
      this.stop();
    }
  }

  stop() {
    if (this.dc) {
      try { this.dc.close(); } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
    this.partialUserText = "";
    this.partialAiText = "";
    this.onStatusChange("disconnected");
  }

  _waitForIceGathering() {
    return new Promise((resolve) => {
      if (!this.pc) return resolve();
      if (this.pc.iceGatheringState === "complete") return resolve();
      const timeout = setTimeout(resolve, 3000); // safety
      this.pc.addEventListener("icegatheringstatechange", () => {
        if (this.pc?.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  _handleEvent(raw) {
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    const type = event.type;

    // --- USER speech transcript (from input_audio_transcription) ---
    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = event.transcript?.trim();
      if (text) {
        this.partialUserText = "";
        this.onMessage({ role: "user", text, final: true });
      }
    }

    // --- AI audio transcript (streaming deltas) ---
    if (type === "response.audio_transcript.delta") {
      this.partialAiText += event.delta || "";
      this.onMessage({ role: "ai", text: this.partialAiText, final: false });
    }
    if (type === "response.audio_transcript.done") {
      const text = event.transcript?.trim() || this.partialAiText;
      this.partialAiText = "";
      this.onMessage({ role: "ai", text, final: true });
    }

    // --- Errors ---
    if (type === "error") {
      console.error("Realtime error event:", event.error);
      this.onError(event.error?.message || "Realtime API error");
    }
  }
}

**/


export class RealtimeService {
  constructor({ onMessage, onStatusChange, onError }) {
    this.ws = null;
    this.audioContext = null;
    this.localStream = null;
    this.processor = null;
    this.source = null;

    // Playback state
    this.playing = false;
    this.playQueue = [];
    this.nextPlayTime = 0;
    this.currentSourceNode = null;

    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onError = onError;
  }

  async start() {
    try {
      this.onStatusChange("connecting");

      // 1. Connect to Backend WS (Matches server port)
      this.ws = new WebSocket("ws://localhost:9000");

      this.ws.onopen = async () => {
        // 2. Setup Microphone
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        this.source = this.audioContext.createMediaStreamSource(this.localStream);

        // Use ScriptProcessorNode for simple PCM16 capture
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => this._handleAudioProcess(e);

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "session.ready") {
          this.onStatusChange("connected");
        }
        else if (data.type === "speech_started") {
          // Barge-in: Clear queue AND stop currently playing audio
          this.playQueue = [];
          if (this.currentSourceNode) {
            this.currentSourceNode.stop();
            this.currentSourceNode = null;
          }
          this.playing = false;
          this.nextPlayTime = 0;
        }
        else if (data.type === "user_transcript") {
          this.onMessage({ role: "user", text: data.text, final: true });
        }
        else if (data.type === "ai_transcript_delta") {
          this.onMessage({ role: "ai", text: data.delta, final: false });
        }
        else if (data.type === "ai_transcript_done") {
          this.onMessage({ role: "ai", text: "", final: true });
        }
        else if (data.type === "audio_delta") {
          this._playAudio(data.delta);
        }
        else if (data.type === "error") {
          this.onError(data.message);
          this.stop();
        }
      };

      this.ws.onerror = () => {
        this.onError("WebSocket error");
        this.stop();
      };

      this.ws.onclose = () => {
        this.stop();
      };

    } catch (err) {
      console.error("Start error:", err);
      this.onError(err.message);
      this.stop();
    }
  }

  _handleAudioProcess(e) {
    const input = e.inputBuffer.getChannelData(0);

    // Convert Float32 Array to 16-bit PCM
    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Base64 encode
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // Send to backend
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "audio_buffer", audio: base64 }));
    }
  }

  _playAudio(base64Audio) {
    if (!this.audioContext) return;

    // Decode Base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(this.audioContext.destination);

    this.playQueue.push(sourceNode);
    this._processQueue();
  }

  _processQueue() {
    if (this.playing || this.playQueue.length === 0) return;

    const sourceNode = this.playQueue.shift();
    const duration = sourceNode.buffer.duration;

    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);

    this.currentSourceNode = sourceNode;
    sourceNode.start(startTime);
    this.playing = true;
    this.nextPlayTime = startTime + duration;

    sourceNode.onended = () => {
      this.playing = false;
      this.currentSourceNode = null;
      this._processQueue();
    };
  }

  stop() {
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());

    if (this.currentSourceNode) {
      this.currentSourceNode.stop();
      this.currentSourceNode = null;
    }

    if (this.audioContext) this.audioContext.close();

    this.audioContext = null;
    this.localStream = null;
    this.processor = null;
    this.source = null;

    if (this.ws) {
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CLOSING) this.ws.close();
      this.ws = null;
    }

    this.playQueue = [];
    this.playing = false;
    this.nextPlayTime = 0;

    this.onStatusChange("disconnected");
  }
}

