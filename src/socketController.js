import events from "./events";
import { chooseWord } from "./words";

let sockets = [];
let inProgress = false;
let word = null;
let leader = null;
let timeout = null;

const chooseLeader = () => sockets[Math.floor(Math.random() * sockets.length)];

const socketController = (socket, io) => {
  const broadcast = (event, data) => socket.broadcast.emit(event, data);
  const superBroadcast = (event, data) => io.emit(event, data);
  const sendPlayerUpdate = () =>
    superBroadcast(events.playerUpdate, { sockets });
  const startGame = () => {
    if (sockets.length > 1 && !inProgress) {
      inProgress = true;
      leader = chooseLeader();
      word = chooseWord();
      superBroadcast(events.gameStarting);
      setTimeout(() => {
        superBroadcast(events.gameStrated);
        io.to(leader.id).emit(events.leaderNotifi, { word });
        timeout = setTimeout(() => endGame(), 30000);
      }, 1000);
    }
  };
  const endGame = () => {
    inProgress = false;
    superBroadcast(events.gameEnded);
    setTimeout(() => startGame(), 2000);
    if (timeout) {
      clearTimeout(timeout);
    }
  };
  const addPoints = (id) => {
    sockets = sockets.map((socket) => {
      if (socket.id === id) {
        socket.points += 10;
      }
      return socket;
    });
    sendPlayerUpdate();
  };

  socket.on(events.setNickname, ({ nickname }) => {
    socket.nickname = nickname;
    sockets.push({ id: socket.id, points: 0, nickname });
    broadcast(events.newUser, { nickname });
    sendPlayerUpdate();
    startGame();
  });

  socket.on(events.disconnect, () => {
    sockets = sockets.filter((aSocket) => socket.id !== aSocket.id);
    if (sockets.length === 1) {
      endGame();
    } else if (leader) {
      if (socket.id === leader.id) {
        endGame();
      }
    }
    broadcast(events.disconnected, { nickname: socket.nickname });
    sendPlayerUpdate();
  });

  socket.on(events.sendMsg, ({ message }) => {
    if (message === word) {
      superBroadcast(events.newMsg, {
        message: `Winner is ${socket.nickname}, Word was ${word}`,
        nickname: "Bot",
      });
      addPoints(socket.id);
      endGame();
    } else {
      broadcast(events.newMsg, { message, nickname: socket.nickname });
    }
  });

  socket.on(events.beginPath, ({ x, y }) => {
    broadcast(events.beganPath, { x, y });
  });

  socket.on(events.strokePath, ({ x, y, color }) => {
    broadcast(events.strokedPath, { x, y, color });
  });

  socket.on(events.fill, ({ color }) => {
    broadcast(events.filled, { color });
  });
};

export default socketController;
