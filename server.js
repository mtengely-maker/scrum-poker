// ... backend rész (server.js)
let taskResults = []; // Ezt a globális változót hozd létre a state mellett

socket.on('reveal', () => {
    state.revealed = true;
    // Mentsd el az aktuális feladat szavazatait
    const currentTaskVotes = {};
    Object.keys(state.players).forEach(id => {
        currentTaskVotes[id] = state.players[id].vote;
    });
    taskResults[state.currentTaskIndex] = currentTaskVotes;
    
    io.emit('state', { ...state, taskResults });
});

socket.on('nextTask', () => {
    state.currentTaskIndex++;
    state.revealed = false;
    Object.keys(state.players).forEach(id => state.players[id].vote = null);
    io.emit('state', { ...state, taskResults });
});
