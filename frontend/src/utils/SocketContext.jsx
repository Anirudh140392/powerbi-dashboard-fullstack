import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import dayjs from "dayjs";

const SocketContext = createContext({
  socketMaxDates: {},
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

/**
 * SocketProvider
 * Connects to the backend WebSocket for real-time Max(Date) updates.
 * Authenticates using the JWT from sessionStorage.
 * Stores max dates per table: { rb_pdp_olap, rb_ms_olap, rb_kw_olap, rb_pm_olap, tb_content_score_data }
 */
export function SocketProvider({ children }) {
  const { isLoggedIn, user } = useAuth();
  const [socketMaxDates, setSocketMaxDates] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!isLoggedIn || !token) {
      // Disconnect if logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setSocketMaxDates({});
      }
      return;
    }

    // Determine backend URL — same as the API but without /api path
    let backendUrl =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      window.location.origin;

    // If it ends with /api, strip it for the socket connection
    if (backendUrl.endsWith("/api")) {
      backendUrl = backendUrl.slice(0, -4);
    }

    console.log("[Socket] 🔌 Connecting to:", backendUrl);

    const socket = io(backendUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected to server");
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] ❌ Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("maxDateUpdate", (data) => {
      console.log("[Socket] 📥 Received maxDateUpdate:", data);
      const isQc = Number(user?.qcUser ?? user?.qc_user) === 1;
      const today = dayjs().format("YYYY-MM-DD");
      const maxAllowed = isQc ? today : dayjs().subtract(1, 'day').format("YYYY-MM-DD");

      const clampVal = (val) => {
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          return val > maxAllowed ? maxAllowed : val;
        }
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const res = {};
          for (const [k, v] of Object.entries(val)) {
            res[k] = clampVal(v);
          }
          return res;
        }
        return val;
      };

      if (data && typeof data === 'object') {
        const clamped = {};
        for (const [k, v] of Object.entries(data)) {
          clamped[k] = clampVal(v);
        }
        setSocketMaxDates(clamped);
      } else {
        setSocketMaxDates(data);
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isLoggedIn, user]);

  return (
    <SocketContext.Provider value={{ socketMaxDates, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export default SocketContext;
