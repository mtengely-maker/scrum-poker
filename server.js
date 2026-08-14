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
    taskResults: {},
    cardDeckType: 'fibonacci' 
};

const emojis = ['🚀', '🦊', '🐼', '🦄', '⚡', '🤖', '🐱', '🦁', '🐯', '🐨'];

const decks = {
    fibonacci: ['1', '2', '3', '5', '8', '13', '21', '?', '☕'],
    extended: ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
    tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']
};

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        const isSM = Object.keys(state.players).length === 0;
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        state.players[socket.id] = { name, isSM, vote: null, emoji: randomEmoji };
        io.emit('state', state);
    });

    socket.on('addTasks', ({ tasks, deckType }) => {
        state.tasks = tasks.filter(t => t.trim() !== "");
        if (deckType && decks[deckType]) {
            state.cardDeckType = deckType;
        }
        state.currentTaskIndex = 0;
        state.taskResults = {};
        state.revealed = false;
        Object.values(state.players).forEach(p => p.vote = null);
        io.emit('state', state);
    });

    socket.on('vote', (vote) => {
        const player = state.players[socket.id];
        // Csak akkor rögzítjük a szavazatot, ha a játékos létezik és NEM Scrum Master
        if (player && !player.isSM) {
            player.vote = vote;
            io.emit('state', state);
        }
    });

    socket.on('reveal', () => {
        state.revealed = true;
        // Csak a nem-SM játékosok szavazatait mentjük el az eredménybe
        const voterVotes = Object.values(state.players)
            .filter(p => !p.isSM)
            .map(p => p.vote);
        state.taskResults[state.currentTaskIndex] = voterVotes;
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

    socket.on('goToTask', (index) => {
        if (index >= 0 && index < state.tasks.length) {
            state.currentTaskIndex = index;
            state.revealed = !!state.taskResults[index];
            io.emit('state', state);
        }
    });

    socket.on('resetGame', () => {
        state = { players: {}, tasks: [], currentTaskIndex: 0, revealed: false, taskResults: {}, cardDeckType: 'fibonacci' };
        io.emit('state', state);
    });

    socket.on('disconnect', () => {
        delete state.players[socket.id];
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
