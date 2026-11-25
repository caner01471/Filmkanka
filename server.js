
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();

io.on("connection", socket => {

  socket.on("join-room", ({ code, name }) => {
    code = String(code || "").trim().toUpperCase().slice(0, 10);
    name = String(name || "Misafir").trim().slice(0, 24) || "Misafir";

    if (!code) {
      return socket.emit("app-error", "Oda kodu gerekli.");
    }

    const room = rooms.get(code) || {
      videoUrl: "",
      videoType: "direct",
      playing: false,
      time: 0
    };

    rooms.set(code, room);

    socket.join(code);
    socket.data.room = code;
    socket.data.name = name;

    socket.emit("room-state", room);

    socket.to(code).emit("member-joined", name);

    const count = io.sockets.adapter.rooms.get(code)?.size || 1;

    socket.emit("joined", { code, count });
    io.to(code).emit("room-count", count);
  });

  socket.on("set-video", data => {
    const roomCode = socket.data.room;

    if (!roomCode) return;

    const url = String(data?.url || "").trim();
    const type = data?.type;

    let valid = false;

    try {
      const parsed = new URL(url);

      if (type === "embed") {
        const host = parsed.hostname.toLowerCase();

        valid =
          parsed.protocol === "https:" &&
          (
            host === "youtube.com" ||
            host === "www.youtube.com" ||
            host === "www.youtube-nocookie.com" ||
            host === "player.vimeo.com"
          );
      }

      if (type === "direct") {
        valid =
          ["https:", "http:"].includes(parsed.protocol) &&
          /\.(mp4|webm|ogg)$/i.test(parsed.pathname);
      }

    } catch {
      valid = false;
    }

    if (!valid) {
      return socket.emit("app-error", "Desteklenmeyen video bağlantısı.");
    }

    const room = rooms.get(roomCode);

    if (!room) return;

    room.videoUrl = url;
    room.videoType = type;
    room.time = 0;
    room.playing = false;

    socket.to(roomCode).emit("video-changed", {
      url,
      type
    });
  });

  socket.on("playback", state => {
    const roomCode = socket.data.room;
    if (!roomCode) return;

    const room = rooms.get(roomCode);

    if (!room || room.videoType !== "direct") return;

    const payload = {
      time: Math.max(0, Number(state.time) || 0),
      playing: !!state.playing,
      sentAt: Date.now()
    };

    Object.assign(room, payload);

    socket.to(roomCode).emit("playback", payload);
  });

  socket.on("chat", message => {
    const roomCode = socket.data.room;
    if (!roomCode) return;

    const text = String(message || "").trim().slice(0, 500);

    if (text) {
      io.to(roomCode).emit("chat", {
        name: socket.data.name,
        text,
        at: Date.now()
      });
    }
  });

  for (const event of [
    "voice-offer",
    "voice-answer",
    "voice-ice"
  ]) {
    socket.on(event, payload => {
      const roomCode = socket.data.room;

      if (roomCode) {
        socket.to(roomCode).emit(event, payload);
      }
    });
  }

  socket.on("disconnect", () => {
    const roomCode = socket.data.room;

    if (roomCode) {
      socket.to(roomCode).emit(
        "member-left",
        socket.data.name || "Bir kullanıcı"
      );

      const count =
        io.sockets.adapter.rooms.get(roomCode)?.size || 0;

      io.to(roomCode).emit("room-count", count);

      if (count === 0) {
        rooms.delete(roomCode);
      }
    }
  });

});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`FilmKanka running on port ${port}`);
});
