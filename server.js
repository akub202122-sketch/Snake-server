const { Server } = require("socket.io");
const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Snake PRO server is running");
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

function makeCode() {
  let c;
  do {
    c = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms[c]);
  return c;
}

io.on("connection", (socket) => {
  console.log("Подключился:", socket.id);

  socket.on("CREATE_ROOM", () => {
    const code = makeCode();
    rooms[code] = {
      host: socket.id,
      mode: "coop",
      players: [{ id: 1, name: "Хост", socketId: socket.id }]
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.playerId = 1;
    socket.emit("ROOM_CREATED", { code });
    io.to(code).emit("LOBBY", { players: rooms[code].players, mode: rooms[code].mode });
  });

  socket.on("JOIN_ROOM", ({ code }) => {
    const room = rooms[code];
    if (!room) { socket.emit("ERROR_MSG", { message: "Комната не найдена" }); return; }
    if (room.players.length >= 3) { socket.emit("FULL"); return; }
    const id = room.players.length + 1;
    room.players.push({ id, name: "Друг " + (id - 1), socketId: socket.id });
    socket.join(code);
    socket.data.room = code;
    socket.data.playerId = id;
    socket.emit("WELCOME", { id, mode: room.mode, code });
    io.to(code).emit("LOBBY", { players: room.players, mode: room.mode });
  });

  socket.on("START_GAME", () => {
    const code = socket.data.room;
    if (!code || !rooms[code]) return;
    io.to(code).emit("START", { mode: rooms[code].mode });
  });

  socket.on("SET_MODE", ({ mode }) => {
    const code = socket.data.room;
    if (!rooms[code]) return;
    rooms[code].mode = mode;
    io.to(code).emit("LOBBY", { players: rooms[code].players, mode });
  });

  socket.on("INPUT", (data) => {
    const code = socket.data.room;
    if (!code || !rooms[code]) return;
    io.to(code).emit("INPUT", { playerId: socket.data.playerId, ...data });
  });

  socket.on("PING", (t) => socket.emit("PONG", t));

  socket.on("disconnect", () => {
    const code = socket.data.room;
    if (!code || !rooms[code]) return;
    rooms[code].players = rooms[code].players.filter(p => p.socketId !== socket.id);
    if (rooms[code].players.length === 0 || rooms[code].host === socket.id) {
      io.to(code).emit("ROOM_CLOSED", { message: "Хост отключился" });
      delete rooms[code];
    } else {
      io.to(code).emit("LOBBY", { players: rooms[code].players, mode: rooms[code].mode });
    }
  });
});

server.listen(PORT, () => {
  console.log("Сервер запущен на порту " + PORT);
});
