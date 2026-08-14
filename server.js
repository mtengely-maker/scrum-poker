let state = { players: {}, tasks: [], currentTaskIndex: 0, revealed: false, taskResults: {} };

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        const isSM = Object.keys(state.players).length === 0;
        state.players[socket.id] = { name, isSM, vote: null };
        io.emit('state', state);
    });

    socket.on('addTasks', (tasks) => {
        state.tasks = tasks;
        state.currentTaskIndex = 0;
        state.taskResults = {};
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
        // Szavazatok mentése a lezárt feladathoz
        state.taskResults[state.currentTaskIndex] = Object.values(state.players).map(p => p.vote);
        io.emit('state', state);
    });

    socket.on('nextTask', () => {
        state.currentTaskIndex++;
        state.revealed = false;
        Object.values(state.players).forEach(p => p.vote = null);
        io.emit('state', state);
    });

    socket.on('resetGame', () => {
        state = { players: {}, tasks: [], currentTaskIndex: 0, revealed: false, taskResults: {} };
        io.emit('state', state);
    });
});
