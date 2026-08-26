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

const emojis = [
    '🚀',
    '🦊',
    '🐼',
    '🦄',
    '⚡',
    '🤖',
    '🐱',
    '🦁',
    '🐯',
    '🐨'
];

const decks = {
    fibonacci: [
        '1',
        '2',
        '3',
        '5',
        '8',
        '13',
        '21',
        '?',
        '☕'
    ],
    extended: [
        '0',
        '0.5',
        '1',
        '2',
        '3',
        '5',
        '8',
        '13',
        '20',
        '40',
        '100',
        '?',
        '☕'
    ],
    tshirt: [
        'XS',
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        '?',
        '☕'
    ]
};

function getFacilitatorEntry() {
    return Object.entries(state.players).find(
        ([, player]) => player.isSM
    );
}

function hasFacilitator() {
    return Boolean(getFacilitatorEntry());
}

function getAvailableEmoji() {
    const usedEmojis = new Set(
        Object.values(state.players).map(player => player.emoji)
    );

    const availableEmojis = emojis.filter(
        emoji => !usedEmojis.has(emoji)
    );

    if (availableEmojis.length > 0) {
        return availableEmojis[
            Math.floor(Math.random() * availableEmojis.length)
        ];
    }

    return emojis[Math.floor(Math.random() * emojis.length)];
}

function emitState() {
    io.emit('state', state);
}

io.on('connection', socket => {
    socket.on('join', payload => {
        const joinData =
            typeof payload === 'string'
                ? {
                    name: payload,
                    role: 'player'
                }
                : payload || {};

        const name = String(joinData.name || '').trim();
        const requestedRole =
            joinData.role === 'facilitator'
                ? 'facilitator'
                : 'player';

        if (!name) {
            socket.emit('joinError', {
                code: 'NAME_REQUIRED',
                message: 'A belépéshez add meg a nevedet.'
            });

            return;
        }

        if (
            requestedRole === 'facilitator' &&
            hasFacilitator()
        ) {
            const facilitatorEntry = getFacilitatorEntry();
            const facilitator = facilitatorEntry
                ? facilitatorEntry[1]
                : null;

            socket.emit('joinError', {
                code: 'FACILITATOR_ALREADY_EXISTS',
                message: facilitator
                    ? `A játékvezetői szerepkör már foglalt: ${facilitator.name}.`
                    : 'A játékvezetői szerepkör már foglalt.'
            });

            return;
        }

        state.players[socket.id] = {
            name,
            role: requestedRole,
            isSM: requestedRole === 'facilitator',
            vote: null,
            emoji: getAvailableEmoji()
        };

        socket.emit('joinSuccess', {
            playerId: socket.id,
            player: state.players[socket.id]
        });

        emitState();
    });

    socket.on('changeRole', requestedRole => {
        const player = state.players[socket.id];

        if (!player) {
            socket.emit('roleChangeError', {
                code: 'PLAYER_NOT_FOUND',
                message: 'A játékos nem található.'
            });

            return;
        }

        const normalizedRole =
            requestedRole === 'facilitator'
                ? 'facilitator'
                : 'player';

        if (
            normalizedRole === 'facilitator' &&
            !player.isSM &&
            hasFacilitator()
        ) {
            const facilitatorEntry = getFacilitatorEntry();
            const facilitator = facilitatorEntry
                ? facilitatorEntry[1]
                : null;

            socket.emit('roleChangeError', {
                code: 'FACILITATOR_ALREADY_EXISTS',
                message: facilitator
                    ? `A játékvezetői szerepkör már foglalt: ${facilitator.name}.`
                    : 'A játékvezetői szerepkör már foglalt.'
            });

            return;
        }

        player.role = normalizedRole;
        player.isSM = normalizedRole === 'facilitator';
        player.vote = null;

        socket.emit('roleChangeSuccess', {
            playerId: socket.id,
            player
        });

        emitState();
    });

    socket.on('addTasks', payload => {
        const player = state.players[socket.id];

        if (!player || !player.isSM) {
            socket.emit('actionError', {
                code: 'FACILITATOR_ONLY',
                message: 'Csak a játékvezető adhat hozzá feladatokat.'
            });

            return;
        }

        const addTasksData = payload || {};
        const receivedTasks = Array.isArray(addTasksData.tasks)
            ? addTasksData.tasks
            : [];

        state.tasks = receivedTasks
            .map(task => String(task).trim())
            .filter(task => task !== '');

        if (
            addTasksData.deckType &&
            decks[addTasksData.deckType]
        ) {
            state.cardDeckType = addTasksData.deckType;
        }

        state.currentTaskIndex = 0;
        state.taskResults = {};
        state.revealed = false;

        Object.values(state.players).forEach(currentPlayer => {
            currentPlayer.vote = null;
        });

        emitState();
    });

    socket.on('vote', vote => {
        const player = state.players[socket.id];

        if (!player || player.isSM) {
            return;
        }

        const activeDeck =
            decks[state.cardDeckType] || decks.fibonacci;

        const normalizedVote = String(vote);

        if (!activeDeck.includes(normalizedVote)) {
            socket.emit('actionError', {
                code: 'INVALID_VOTE',
                message: 'A kiválasztott becslés nem érvényes.'
            });

            return;
        }

        player.vote = normalizedVote;

        emitState();
    });

    socket.on('reveal', () => {
        const player = state.players[socket.id];

        if (!player || !player.isSM) {
            socket.emit('actionError', {
                code: 'FACILITATOR_ONLY',
                message: 'Csak a játékvezető fedheti fel a becsléseket.'
            });

            return;
        }

        state.revealed = true;

        const voterVotes = Object.values(state.players)
            .filter(currentPlayer => !currentPlayer.isSM)
            .map(currentPlayer => currentPlayer.vote);

        state.taskResults[state.currentTaskIndex] =
            voterVotes;

        emitState();
    });

    socket.on('nextTask', () => {
        const player = state.players[socket.id];

        if (!player || !player.isSM) {
            socket.emit('actionError', {
                code: 'FACILITATOR_ONLY',
                message: 'Csak a játékvezető léphet a következő feladatra.'
            });

            return;
        }

        if (
            state.currentTaskIndex <
            state.tasks.length - 1
        ) {
            state.currentTaskIndex++;
            state.revealed = false;

            Object.values(state.players).forEach(
                currentPlayer => {
                    currentPlayer.vote = null;
                }
            );

            emitState();
        }
    });

    socket.on('goToTask', index => {
        const player = state.players[socket.id];

        if (!player || !player.isSM) {
            socket.emit('actionError', {
                code: 'FACILITATOR_ONLY',
                message: 'Csak a játékvezető válthat feladatot.'
            });

            return;
        }

        const taskIndex = Number(index);

        if (
            Number.isInteger(taskIndex) &&
            taskIndex >= 0 &&
            taskIndex < state.tasks.length
        ) {
            state.currentTaskIndex = taskIndex;
            state.revealed = Boolean(
                state.taskResults[taskIndex]
            );

            Object.values(state.players).forEach(
                currentPlayer => {
                    currentPlayer.vote = null;
                }
            );

            emitState();
        }
    });

    socket.on('resetGame', () => {
        const player = state.players[socket.id];

        if (!player || !player.isSM) {
            socket.emit('actionError', {
                code: 'FACILITATOR_ONLY',
                message: 'Csak a játékvezető indíthat új játékot.'
            });

            return;
        }

        state.tasks = [];
        state.currentTaskIndex = 0;
        state.revealed = false;
        state.taskResults = {};

        Object.values(state.players).forEach(
            currentPlayer => {
                currentPlayer.vote = null;
            }
        );

        emitState();
    });

    socket.on('disconnect', () => {
        delete state.players[socket.id];

        /*
         * Szándékosan nem nevezünk ki automatikusan
         * új játékvezetőt.
         *
         * Ha a játékvezető kilép, a szerepkör szabaddá válik,
         * és egy jelenlegi játékos a changeRole eseménnyel
         * átveheti azt.
         */

        emitState();
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});