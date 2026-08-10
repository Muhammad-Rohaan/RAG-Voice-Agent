export class RealtimeService {
  constructor({
    onMessage,
    onStatusChange,
    onError,
  }) {
    this.ws = null;

    this.audioContext = null;
    this.localStream = null;
    this.processor = null;
    this.source = null;

    this.sessionReady = false;

    this.playQueue = [];
    this.activeSources = new Set();

    this.playing = false;
    this.nextPlayTime = 0;

    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    /*
    |--------------------------------------------------------------------------
    | Backend URL
    |--------------------------------------------------------------------------
    */

    this.backendWsUrl =
      import.meta.env.VITE_BACKEND_WS_URL ||
      "ws://localhost:9000";
  }

  /*
  |--------------------------------------------------------------------------
  | Start realtime voice session
  |--------------------------------------------------------------------------
  */

  async start() {
    try {
      this.onStatusChange("connecting");

      console.log(
        "🔌 Connecting to backend:",
        this.backendWsUrl
      );

      /*
      |--------------------------------------------------------------------------
      | Connect to our backend
      |--------------------------------------------------------------------------
      */

      this.ws = new WebSocket(
        this.backendWsUrl
      );

      /*
      |--------------------------------------------------------------------------
      | WebSocket opened
      |--------------------------------------------------------------------------
      */

      this.ws.onopen = async () => {
        try {
          console.log(
            "🔌 Voice WS Connected"
          );

          /*
          |--------------------------------------------------------------------------
          | Setup microphone
          |--------------------------------------------------------------------------
          */

          await this._setupMicrophone();

        } catch (error) {
          console.error(
            "❌ Microphone setup failed:",
            error
          );

          this.onError(
            error.message ||
            "Could not access microphone."
          );

          this.stop();
        }
      };

      /*
      |--------------------------------------------------------------------------
      | Backend messages
      |--------------------------------------------------------------------------
      */

      this.ws.onmessage = (event) => {
        try {
          const data =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;

          this._handleServerMessage(data);

        } catch (error) {
          console.error(
            "❌ Failed to process WS message:",
            error
          );
        }
      };

      /*
      |--------------------------------------------------------------------------
      | WebSocket error
      |--------------------------------------------------------------------------
      */

      this.ws.onerror = (error) => {
        console.error(
          "❌ Browser WebSocket error:",
          error
        );

        this.onError(
          "Voice WebSocket connection error."
        );
      };

      /*
      |--------------------------------------------------------------------------
      | WebSocket closed
      |--------------------------------------------------------------------------
      */

      this.ws.onclose = () => {
        console.log(
          "🔌 Voice WebSocket closed."
        );

        this.stop(false);
      };

    } catch (error) {
      console.error(
        "❌ Realtime start error:",
        error
      );

      this.onError(
        error.message ||
        "Unable to start voice session."
      );

      this.stop();
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Setup microphone
  |--------------------------------------------------------------------------
  */

  async _setupMicrophone() {
    /*
    |--------------------------------------------------------------------------
    | Request microphone
    |--------------------------------------------------------------------------
    */

    this.localStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

    /*
    |--------------------------------------------------------------------------
    | Create AudioContext
    |--------------------------------------------------------------------------
    */

    this.audioContext =
      new AudioContext({
        sampleRate: 24000,
      });

    /*
    |--------------------------------------------------------------------------
    | Browser may ignore requested sample rate.
    |--------------------------------------------------------------------------
    */

    console.log(
      "🎧 Browser AudioContext sample rate:",
      this.audioContext.sampleRate
    );

    /*
    |--------------------------------------------------------------------------
    | Microphone source
    |--------------------------------------------------------------------------
    */

    this.source =
      this.audioContext.createMediaStreamSource(
        this.localStream
      );

    /*
    |--------------------------------------------------------------------------
    | ScriptProcessor
    |--------------------------------------------------------------------------
    |
    | This is deprecated, but still supported by browsers.
    |
    | It is intentionally kept here to make your current project easy
    | to understand. It is NOT the reason the model was not responding.
    |
    */

    this.processor =
      this.audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

    this.processor.onaudioprocess = (event) => {
      this._handleAudioProcess(event);
    };

    /*
    |--------------------------------------------------------------------------
    | Connect microphone → processor
    |--------------------------------------------------------------------------
    */

    this.source.connect(
      this.processor
    );

    /*
    |--------------------------------------------------------------------------
    | Processor must be connected for Chrome to execute it.
    |--------------------------------------------------------------------------
    */

    this.processor.connect(
      this.audioContext.destination
    );

    /*
    |--------------------------------------------------------------------------
    | Resume AudioContext
    |--------------------------------------------------------------------------
    */

    if (
      this.audioContext.state === "suspended"
    ) {
      await this.audioContext.resume();
    }

    console.log(
      "🎤 Microphone is ready."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Process microphone audio
  |--------------------------------------------------------------------------
  */

  _handleAudioProcess(event) {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Do not send audio until OpenAI session is ready.
    |--------------------------------------------------------------------------
    */

    if (!this.sessionReady) {
      return;
    }

    const input =
      event.inputBuffer.getChannelData(0);

    /*
    |--------------------------------------------------------------------------
    | Convert/resample to 24kHz PCM16
    |--------------------------------------------------------------------------
    */

    const pcm16 =
      this._float32ToPCM16At24kHz(
        input,
        this.audioContext.sampleRate
      );

    if (!pcm16 || pcm16.length === 0) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | PCM16 → Base64
    |--------------------------------------------------------------------------
    */

    const base64 =
      this._arrayBufferToBase64(
        pcm16.buffer
      );

    /*
    |--------------------------------------------------------------------------
    | Send audio to backend
    |--------------------------------------------------------------------------
    */

    this.ws.send(
      JSON.stringify({
        type: "audio_buffer",
        audio: base64,
      })
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Resample Float32 → 24kHz PCM16
  |--------------------------------------------------------------------------
  */

  _float32ToPCM16At24kHz(
    input,
    inputSampleRate
  ) {
    const targetSampleRate = 24000;

    /*
    |--------------------------------------------------------------------------
    | No resampling needed
    |--------------------------------------------------------------------------
    */

    if (
      inputSampleRate ===
      targetSampleRate
    ) {
      const output =
        new Int16Array(input.length);

      for (
        let i = 0;
        i < input.length;
        i++
      ) {
        const sample =
          Math.max(
            -1,
            Math.min(1, input[i])
          );

        output[i] =
          sample < 0
            ? sample * 0x8000
            : sample * 0x7fff;
      }

      return output;
    }

    /*
    |--------------------------------------------------------------------------
    | Resample
    |--------------------------------------------------------------------------
    */

    const ratio =
      inputSampleRate /
      targetSampleRate;

    const outputLength =
      Math.max(
        1,
        Math.round(
          input.length / ratio
        )
      );

    const output =
      new Int16Array(
        outputLength
      );

    for (
      let i = 0;
      i < outputLength;
      i++
    ) {
      const position =
        i * ratio;

      const index =
        Math.floor(position);

      const nextIndex =
        Math.min(
          index + 1,
          input.length - 1
        );

      const fraction =
        position - index;

      const sample =
        input[index] *
        (1 - fraction) +
        input[nextIndex] *
        fraction;

      const clamped =
        Math.max(
          -1,
          Math.min(1, sample)
        );

      output[i] =
        clamped < 0
          ? clamped * 0x8000
          : clamped * 0x7fff;
    }

    return output;
  }

  /*
  |--------------------------------------------------------------------------
  | ArrayBuffer → Base64
  |--------------------------------------------------------------------------
  */

  _arrayBufferToBase64(
    arrayBuffer
  ) {
    const bytes =
      new Uint8Array(
        arrayBuffer
      );

    const chunkSize = 0x8000;

    let binary = "";

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      const chunk =
        bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        );

      binary += String.fromCharCode(
        ...chunk
      );
    }

    return btoa(binary);
  }

  /*
  |--------------------------------------------------------------------------
  | Handle backend events
  |--------------------------------------------------------------------------
  */

  _handleServerMessage(data) {
    switch (data.type) {
      /*
      |--------------------------------------------------------------------------
      | OpenAI session is ready
      |--------------------------------------------------------------------------
      */

      case "session.ready":
        console.log(
          "🟢 OpenAI Realtime session ready."
        );

        this.sessionReady = true;

        this.onStatusChange(
          "connected"
        );

        this.onMessage({
          type: "session_ready",
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | User started speaking
      |--------------------------------------------------------------------------
      */

      case "speech_started":
        console.log(
          "🎤 User speaking..."
        );

        /*
        |--------------------------------------------------------------------------
        | Stop currently playing AI audio.
        |--------------------------------------------------------------------------
        */

        this._stopCurrentAudio();

        this.onMessage({
          type: "speech_started",
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | User stopped speaking
      |--------------------------------------------------------------------------
      */

      case "speech_stopped":
        console.log(
          "🛑 User stopped speaking."
        );

        this.onMessage({
          type: "speech_stopped",
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | Final user transcript
      |--------------------------------------------------------------------------
      */

      case "user_transcript":
        console.log(
          "👤 User:",
          data.text
        );

        this.onMessage({
          role: "user",
          text: data.text,
          final: true,
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | AI transcript streaming
      |--------------------------------------------------------------------------
      */

      case "ai_transcript_delta":
        this.onMessage({
          role: "ai",
          text: data.delta,
          final: false,
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | AI transcript finished
      |--------------------------------------------------------------------------
      */

      case "ai_transcript_done":
        this.onMessage({
          role: "ai",
          text: "",
          final: true,
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | AI audio
      |--------------------------------------------------------------------------
      */

      case "audio_delta":
        this._playAudio(
          data.delta
        );

        break;

      /*
      |--------------------------------------------------------------------------
      | AI audio completed
      |--------------------------------------------------------------------------
      */

      case "audio_done":
        this.onMessage({
          type: "audio_done",
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | Complete response
      |--------------------------------------------------------------------------
      */

      case "response_done":
        this.onMessage({
          type: "response_done",
        });

        break;

      /*
      |--------------------------------------------------------------------------
      | OpenAI error
      |--------------------------------------------------------------------------
      */

      case "error":
        console.error(
          "❌ Voice error:",
          data.message
        );

        this.onError(
          data.message ||
          "Voice model error."
        );

        break;

      /*
      |--------------------------------------------------------------------------
      | OpenAI connection closed
      |--------------------------------------------------------------------------
      */

      case "openai_closed":
        console.warn(
          "⚠️ OpenAI Realtime connection closed."
        );

        this.sessionReady = false;

        break;

      default:
        /*
        |--------------------------------------------------------------------------
        | Ignore unknown events.
        |--------------------------------------------------------------------------
        */
        break;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Play PCM16 audio
  |--------------------------------------------------------------------------
  */

  _playAudio(base64Audio) {
    if (
      !this.audioContext ||
      !base64Audio
    ) {
      return;
    }

    try {
      /*
      |--------------------------------------------------------------------------
      | Base64 → bytes
      |--------------------------------------------------------------------------
      */

      const binary =
        atob(base64Audio);

      const bytes =
        new Uint8Array(
          binary.length
        );

      for (
        let i = 0;
        i < binary.length;
        i++
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      /*
      |--------------------------------------------------------------------------
      | Ensure even number of bytes
      |--------------------------------------------------------------------------
      */

      if (bytes.length % 2 !== 0) {
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | PCM16 little-endian
      |--------------------------------------------------------------------------
      */

      const pcm16 =
        new Int16Array(
          bytes.buffer
        );

      const float32 =
        new Float32Array(
          pcm16.length
        );

      for (
        let i = 0;
        i < pcm16.length;
        i++
      ) {
        float32[i] =
          pcm16[i] / 32768;
      }

      /*
      |--------------------------------------------------------------------------
      | Create 24kHz audio buffer
      |--------------------------------------------------------------------------
      */

      const audioBuffer =
        this.audioContext.createBuffer(
          1,
          float32.length,
          24000
        );

      audioBuffer.copyToChannel(
        float32,
        0
      );

      /*
      |--------------------------------------------------------------------------
      | Create playback source
      |--------------------------------------------------------------------------
      */

      const sourceNode =
        this.audioContext.createBufferSource();

      sourceNode.buffer =
        audioBuffer;

      sourceNode.connect(
        this.audioContext.destination
      );

      /*
      |--------------------------------------------------------------------------
      | Queue source
      |--------------------------------------------------------------------------
      */

      this.playQueue.push(
        sourceNode
      );

      this._processQueue();

    } catch (error) {
      console.error(
        "❌ Audio playback error:",
        error
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Process audio queue
  |--------------------------------------------------------------------------
  */

  _processQueue() {
    if (
      !this.audioContext ||
      this.playQueue.length === 0
    ) {
      return;
    }

    const sourceNode =
      this.playQueue.shift();

    if (!sourceNode?.buffer) {
      this._processQueue();
      return;
    }

    const now =
      this.audioContext.currentTime;

    const startTime =
      Math.max(
        now,
        this.nextPlayTime
      );

    try {
      sourceNode.start(
        startTime
      );
    } catch (error) {
      console.error(
        "❌ Failed to start audio source:",
        error
      );

      this._processQueue();
      return;
    }

    this.playing = true;

    this.activeSources.add(
      sourceNode
    );

    this.nextPlayTime =
      startTime +
      sourceNode.buffer.duration;

    sourceNode.onended = () => {
      this.activeSources.delete(
        sourceNode
      );

      if (
        this.activeSources.size === 0
      ) {
        this.playing = false;
      }

      this._processQueue();
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Stop AI audio immediately
  |--------------------------------------------------------------------------
  */

  _stopCurrentAudio() {
    /*
    |--------------------------------------------------------------------------
    | Stop queued audio
    |--------------------------------------------------------------------------
    */

    this.playQueue = [];

    /*
    |--------------------------------------------------------------------------
    | Stop currently playing/scheduled sources
    |--------------------------------------------------------------------------
    */

    for (
      const sourceNode of this
        .activeSources
    ) {
      try {
        sourceNode.stop();
      } catch {
        /*
        | Source may already have stopped.
        */
      }
    }

    this.activeSources.clear();

    this.playing = false;
    this.nextPlayTime = 0;
  }

  /*
  |--------------------------------------------------------------------------
  | Stop entire realtime session
  |--------------------------------------------------------------------------
  */

  stop(updateStatus = true) {
    this.sessionReady = false;

    /*
    |--------------------------------------------------------------------------
    | Stop microphone processor
    |--------------------------------------------------------------------------
    */

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch { }
    }

    /*
    |--------------------------------------------------------------------------
    | Stop microphone source
    |--------------------------------------------------------------------------
    */

    if (this.source) {
      try {
        this.source.disconnect();
      } catch { }
    }

    /*
    |--------------------------------------------------------------------------
    | Stop microphone tracks
    |--------------------------------------------------------------------------
    */

    if (this.localStream) {
      this.localStream
        .getTracks()
        .forEach((track) => {
          try {
            track.stop();
          } catch { }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Stop audio playback
    |--------------------------------------------------------------------------
    */

    this._stopCurrentAudio();

    /*
    |--------------------------------------------------------------------------
    | Close AudioContext
    |--------------------------------------------------------------------------
    */

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch { }
    }

    this.audioContext = null;
    this.localStream = null;
    this.processor = null;
    this.source = null;

    /*
    |--------------------------------------------------------------------------
    | Close WebSocket
    |--------------------------------------------------------------------------
    */

    if (this.ws) {
      this.ws.onclose = null;

      if (
        this.ws.readyState ===
        WebSocket.OPEN ||
        this.ws.readyState ===
        WebSocket.CONNECTING
      ) {
        try {
          this.ws.close();
        } catch { }
      }

      this.ws = null;
    }

    if (updateStatus) {
      this.onStatusChange(
        "disconnected"
      );
    }
  }
}