
const socket = io();

const $ = id => document.getElementById(id);

let roomCode = "";
let memberCount = 1;
let isHost = false;
let localStream = null;
let peer = null;
let pendingOffer = null;
let pendingIce = [];
let syncing = false;

function addMessage(name, message) {
  const item = document.createElement("p");
  item.textContent = name + ": " + message;
  $("messages").appendChild(item);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function loadVideo(url) {
  $("video").src = url;
  $("emptyVideo").style.display = "none";
}

$("join").onclick = () => {
  const name = $("name").value.trim() || "Misafir";
  roomCode = $("room").value.trim().toUpperCase();

  if (!roomCode) {
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  socket.emit("join-room", { code: roomCode, name });
};

socket.on("joined", data => {
  roomCode = data.code;
  memberCount = data.count;
  isHost = data.count === 1;

  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("roomCode").textContent = roomCode;
  $("people").textContent = memberCount + " kişi";
  $("status").textContent = "Bağlandı";
});

socket.on("room-state", state => {
  if (state.videoUrl) {
    loadVideo(state.videoUrl);
    $("video").addEventListener("loadedmetadata", function ready() {
      $("video").removeEventListener("loadedmetadata", ready);
      syncing = true;
      $("video").currentTime = state.time || 0;
      if (state.playing) $("video").play().catch(() => {});
      setTimeout(() => syncing = false, 500);
    });
  }
});

socket.on("room-count", count => {
  memberCount = count;
  $("people").textContent = count + " kişi";
});

socket.on("member-joined", name => {
  addMessage("Sistem", name + " odaya katıldı.");
});

socket.on("member-left", name => {
  addMessage("Sistem", name + " odadan ayrıldı.");
});

socket.on("app-error", message => alert(message));

$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    $("copy").textContent = "Kopyalandı!";
  } catch {
    prompt("Oda kodunu kopyala:", roomCode);
  }
};

$("loadVideo").onclick = () => {
  const url = $("videoUrl").value.trim();

  if (!/^https?:\/\//i.test(url)) {
    alert("Geçerli bir video bağlantısı gir.");
    return;
  }

  loadVideo(url);
  socket.emit("set-video", url);
};

function sendPlayback() {
  if (syncing || !roomCode) return;

  socket.emit("playback", {
    time: $("video").currentTime,
    playing: !$("video").paused
  });
}

$("video").addEventListener("play", sendPlayback);
$("video").addEventListener("pause", sendPlayback);
$("video").addEventListener("seeked", sendPlayback);

socket.on("video-changed", url => {
  loadVideo(url);
});

socket.on("playback", state => {
  const video = $("video");
  syncing = true;

  const delay = state.playing
    ? Math.max(0, (Date.now() - state.sentAt) / 1000)
    : 0;

  video.currentTime = state.time + delay;

  if (state.playing) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }

  setTimeout(() => syncing = false, 500);
});

$("chatForm").onsubmit = event => {
  event.preventDefault();

  const message = $("chatInput").value.trim();
  if (!message) return;

  socket.emit("chat", message);
  $("chatInput").value = "";
};

socket.on("chat", data => {
  addMessage(data.name, data.text);
});

// Sesli sohbet

function createPeer() {
  if (peer) return peer;

  peer = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });
  }

  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("voice-ice", event.candidate);
    }
  };

  peer.ontrack = event => {
    $("remoteAudio").srcObject = event.streams[0];
  };

  return peer;
}

async function startVoice() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    createPeer();

    if (pendingOffer) {
      await handleOffer(pendingOffer);
      pendingOffer = null;
    } else if (!isHost && memberCount >= 2) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("voice-offer", {
        sdp: peer.localDescription
      });
    }

    $("voice").textContent = "Sesli sohbete katıldın";
    $("voice").disabled = true;

  } catch (error) {
    alert("Mikrofon açılamadı. Tarayıcı izinlerini kontrol et.");
  }
}

async function handleOffer(data) {
  if (!localStream) {
    pendingOffer = data;
    return;
  }

  createPeer();

  await peer.setRemoteDescription(data.sdp);

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  socket.emit("voice-answer", {
    sdp: peer.localDescription
  });

  for (const candidate of pendingIce) {
    await peer.addIceCandidate(candidate);
  }

  pendingIce = [];
}

$("voice").onclick = startVoice;

socket.on("voice-offer", async data => {
  try {
    if (!localStream) {
      pendingOffer = data;
      return;
    }

    await handleOffer(data);
  } catch (error) {
    console.error(error);
  }
});

socket.on("voice-answer", async data => {
  try {
    if (peer) {
      await peer.setRemoteDescription(data.sdp);

      for (const candidate of pendingIce) {
        await peer.addIceCandidate(candidate);
      }

      pendingIce = [];
    }
  } catch (error) {
    console.error(error);
  }
});

socket.on("voice-ice", async candidate => {
  try {
    if (peer && peer.remoteDescription) {
      await peer.addIceCandidate(candidate);
    } else {
      pendingIce.push(candidate);
    }
  } catch (error) {
    console.error(error);
  }
});
