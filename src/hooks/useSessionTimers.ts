import { useEffect, useState } from "react";
import { loadSession } from "../lib/services/session.service";

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface SessionTimers {
  sessionTimeLeft: string;
  sessionExpired: boolean;
  sessionActive: boolean;
}

export function useSessionTimers(): SessionTimers {
  const [sessionTimeLeft, setSessionTimeLeft] = useState("00:00");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    function tick() {
      const session = loadSession();
      if (session) {
        const diff = session.expiresAt - Date.now();
        setSessionTimeLeft(formatTimeLeft(diff));
        setSessionExpired(diff <= 0);
        setSessionActive(true);
      } else {
        setSessionTimeLeft("00:00");
        setSessionExpired(false);
        setSessionActive(false); // no session → hide the badge
      }
    }

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return { sessionTimeLeft, sessionExpired, sessionActive };
}
