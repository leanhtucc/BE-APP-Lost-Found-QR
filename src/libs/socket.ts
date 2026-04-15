import http from "http";
import { Server } from "socket.io";

let io: Server | null = null;

export function initSocketServer(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: "*", // TODO: restrict in production
      methods: ["GET", "POST"],
    },
  });
  console.log("🔌 Socket.io server initialized");
}

export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.io not initialized. Call initSocketServer(server) first."
    );
  }
  return io;
}
