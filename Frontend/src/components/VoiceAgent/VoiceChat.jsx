import React, { useRef, useEffect } from "react";
import { useRealtime } from "../../hooks/useRealtime.js";

export default function VoiceChat() {
    const { status, messages, error, start, stop } = useRealtime();
    const conversationRef = useRef(null);

    // Auto-scroll conversation to bottom on new messages
    useEffect(() => {
        if (conversationRef.current) {
            conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
        }
    }, [messages]);

    const isConnected = status === "connected";
    const isConnecting = status === "connecting";

    return (
        <div>
            <div className="card">
                <div className="status">
                    <span className={`status-dot ${status}`} />
                    <span>
                        Status:{" "}
                        <strong>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </strong>
                    </span>
                </div>

                {error && (
                    <div className="error">
                        {typeof error === "string" ? error : JSON.stringify(error)}
                    </div>
                )}

                <button
                    onClick={isConnected || isConnecting ? stop : start}
                    disabled={false}
                    className={isConnected || isConnecting ? "danger" : ""}
                >
                    {isConnecting && "Connecting..."}
                    {isConnected && "Disconnect"}
                    {status === "disconnected" && "Connect"}
                </button>

                <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
                    {isConnected
                        ? "🎙️ Speak into your microphone. The AI will respond with voice."
                        : "Click Connect and allow microphone access to start."}
                </p>
            </div>

            <div className="card">
                <h2 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Conversation</h2>
                <div className="conversation" ref={conversationRef}>
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            No messages yet. Start speaking after connecting.
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div
                                key={i}
                                className={`message ${m.role} ${m.final ? "" : "partial"}`}
                            >
                                <strong>{m.role === "user" ? "You: " : "AI: "}</strong>
                                {m.text}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}