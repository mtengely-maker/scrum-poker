const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let state = { 
    players: {}, 
    tasks: [], 
    currentTaskIndex: 0, 
    revealed: false, 
    taskResults: {} 
};

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        const isSM = Object.keys(state.players).length === 0;
        state.players[socket.id] = { name, isSM, vote: null };
        io.emit('state', state);
    });

    socket.on('addTasks', (tasks) => {
        state.tasks = tasks.filter(t => t.trim() !== "");
        state.currentTaskIndex = 0;
        state.taskResults = {};
        state.revealed = false;
        io.emit('state', state);
    });

    socket.on('vote', (vote) => {
        if(state.players[socket.id]) {
            state.players[socket.id].vote = vote;
            io.emit('state', state);
        }
    });

    socket.on('reveal', () => {
        state.revealed = true;
        state.taskResults[state.currentTaskIndex] = Object.values(state.players).map(p => p.vote);
        io.emit('state', state);
    });

    socket.on('nextTask', () => {
        if (state.currentTaskIndex < state.tasks.length - 1) {
            state.currentTaskIndex++;
            state.revealed = false;
            Object.values(state.players).forEach(p => p.vote = null);
            io.emit('state', state);
        }
    });

    socket.on('resetGame', () => {
        state = { players: {}, tasks: [], currentTaskIndex: 0, revealed: false, taskResults: {} };
        io.emit('state', state);
    });

    socket.on('disconnect', () => {
        delete state.players[socket.id];
        // Ha kilépett az SM, adjuk át a jogot másnak
        const remainingPlayers = Object.values(state.players);
        if (remainingPlayers.length > 0 && !remainingPlayers.some(p => p.isSM)) {
            const firstId = Object.keys(state.players)[0];
            state.players[firstId].isSM = true;
        }
        io.emit('state', state);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
