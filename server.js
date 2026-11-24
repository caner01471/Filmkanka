const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

io.on("connection", socket => {
  socket.on("join-room", ({ code, name }) => {
    code = String(code || "").trim().toUpperCase().slice(0, 10);
    name = String(name || "Misafir").trim().slice(0, 24) || "Misafir";
    if (!code) return socket.emit("app-error", "Oda kodu gerekli.");
    const room = rooms.get(code) || { videoUrl: "", playing: false, time: 0 };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;
    socket.emit("room-state", room);
    socket.to(code).emit("member-joined", name);
    socket.emit("joined", { code, count: io.sockets.adapter.rooms.get(code)?.size || 1 });
    io.to(code).emit("room-count", io.sockets.adapter.rooms.get(code)?.size || 1);
  });

  socket.on("set-video", url => {
    const room = socket.data.room;
    if (!room) return;
    const safeUrl = String(url || "").trim();
    if (!/^https?:\/\//i.test(safeUrl)) return socket.emit("app-error", "Geçerli bir http/https video bağlantısı gir.");
    rooms.get(room).videoUrl = safeUrl;
    rooms.get(room).time = 0;
    rooms.get(room).playing = false;
    socket.to(room).emit("video-changed", safeUrl);
  });

  socket.on("playback", state => {
    const room = socket.data.room;
    if (!room) return;
    const payload = { time: Math.max(0, Number(state.time) || 0), playing: !!state.playing, sentAt: Date.now() };
    Object.assign(rooms.get(room), payload);
    socket.to(room).emit("playback", payload);
  });

  socket.on("chat", message => {
    const room = socket.data.room;
    if (!room) return;
    const text = String(message || "").trim().slice(0, 500);
    if (text) io.to(room).emit("chat", { name: socket.data.name, text, at: Date.now() });
  });

  // WebRTC signaling: audio stays peer-to-peer; server only relays setup messages.
  for (const event of ["voice-offer", "voice-answer", "voice-ice"]) {
    socket.on(event, payload => {
      const room = socket.data.room;
      if (room) socket.to(room).emit(event, payload);
    });
  }

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (room) {
      socket.to(room).emit("member-left", socket.data.name || "Bir kullanıcı");
      const count = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit("room-count", count);
      if (count === 0) rooms.delete(room);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`FilmKanka running on http://localhost:${port}`));
