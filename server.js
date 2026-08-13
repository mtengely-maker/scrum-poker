const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let state = {
  tasks: [],
  currentTaskIndex: 0,
  players: {},
  revealed: false
};

io.on('connection', (socket) => {
  socket.emit('state', state);

  socket.on('join', (name) => {
    const isSM = Object.keys(state.players).length === 0;
    state.players[socket.id] = { name, vote: null, isSM };
    io.emit('state', state);
  });

  socket.on('addTasks', (tasksList) => {
    state.tasks = tasksList.filter(t => t.trim() !== '');
    state.currentTaskIndex = 0;
    state.revealed = false;
    for (let id in state.players) {
      state.players[id].vote = null;
    }
    io.emit('state', state);
  });

  socket.on('vote', (vote) => {
    if (state.players[socket.id]) {
      state.players[socket.id].vote = vote;
      io.emit('state', state);
    }
  });

  socket.on('reveal', () => {
    state.revealed = true;
    io.emit('state', state);
  });

  socket.on('nextTask', () => {
    if (state.currentTaskIndex < state.tasks.length - 1) {
      state.currentTaskIndex++;
      state.revealed = false;
      for (let id in state.players) {
        state.players[id].vote = null;
      }
      io.emit('state', state);
    }
  });

  socket.on('resetGame', () => {
    state.tasks = [];
    state.currentTaskIndex = 0;
    state.revealed = false;
    for (let id in state.players) {
      state.players[id].vote = null;
    }
    io.emit('state', state);
  });

  socket.on('disconnect', () => {
    delete state.players[socket.id];
    io.emit('state', state);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Fut a szerver ezen a porton: ${PORT}`);
});
