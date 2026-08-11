import { useState, useRef, useCallback } from "react";
import { RealtimeService } from "../services/realtime.js";

export function useRealtime() {
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const serviceRef = useRef(null);

  const handleMessage = useCallback((msg) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];

      // Update partial (in-progress) message of same role
      if (!msg.final && last && last.role === msg.role && !last.final) {
        return [...prev.slice(0, -1), { ...msg }];
      }

      // If we get a final, replace any pending partial of same role
      if (msg.final && last && last.role === msg.role && !last.final) {
        return [...prev.slice(0, -1), { ...msg }];
      }

      // Otherwise append
      return [...prev, { ...msg }];
    });
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setMessages([]);
    const service = new RealtimeService({
      onMessage: handleMessage,
      onStatusChange: setStatus,
      onError: (msg) => setError(msg),
    });
    serviceRef.current = service;
    await service.start();
  }, [handleMessage]);

  const stop = useCallback(() => {
    serviceRef.current?.stop();
    serviceRef.current = null;
  }, []);

  return { status, messages, error, start, stop };
}