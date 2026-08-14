<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <title>Scrum Poker Pro</title>
    <style>
        :root { --primary: #6366f1; --bg: #0f172a; --panel: #1e293b; }
        body { margin: 0; background: var(--bg); color: white; font-family: sans-serif; height: 100vh; display: flex; }
        .sidebar { width: 220px; background: var(--panel); padding: 15px; border-right: 1px solid #334155; }
        .container { flex-grow: 1; padding: 20px; display: flex; flex-direction: column; }
        .controls { background: var(--panel); padding: 15px; border-radius: 10px; margin-bottom: 10px; }
        .card { width: 50px; height: 60px; background: #334155; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 5px; margin: 3px; }
        .btn { padding: 8px 16px; border-radius: 6px; border: none; background: var(--primary); color: white; cursor: pointer; }
    </style>
</head>
<body>
    <div class="sidebar">
        <strong>Feladatok</strong>
        <div id="history-list" style="margin-top:10px;"></div>
    </div>
    <div class="container">
        <div id="login-screen">
            <input type="text" id="username" placeholder="Neved...">
            <button class="btn" onclick="join()">Belépés</button>
        </div>
        <div id="game-screen" style="display:none; flex-direction:column;">
            <div id="sm-panel" class="controls" style="display:none;">
                <textarea id="tasks" rows="2" placeholder="Feladatok (újsorral)..."></textarea><br>
                <button class="btn" onclick="start()">Indítás</button>
                <button class="btn" onclick="resetGame()" style="background:#dc2626;">Reset</button>
            </div>
            
            <div id="table-area" style="text-align:center; padding:50px;">
                <h2 id="task-title">Várakozás...</h2>
                <h1 id="avg-display" style="font-size:3rem; color:var(--primary);"></h1>
            </div>

            <div id="cards"></div>
            <button class="btn" onclick="socket.emit('reveal')" style="width:200px; margin-top:20px;">Felfedés</button>
            <button class="btn" onclick="socket.emit('nextTask')" style="width:200px; margin-top:10px;">Következő</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        function join() { socket.emit('join', document.getElementById('username').value); document.getElementById('login-screen').style.display='none'; document.getElementById('game-screen').style.display='flex'; }
        function start() { socket.emit('addTasks', document.getElementById('tasks').value.split('\n')); }
        function resetGame() { socket.emit('resetGame'); }
        
        ['1','2','3','5','8','13','21','?'].forEach(v => {
            const d = document.createElement('div'); d.className='card'; d.innerText=v;
            d.onclick = () => socket.emit('vote', v);
            document.getElementById('cards').appendChild(d);
        });

        socket.on('state', (s) => {
            if(s.players[socket.id]?.isSM) document.getElementById('sm-panel').style.display = 'block';
            document.getElementById('task-title').innerText = s.tasks[s.currentTaskIndex] || "Nincs feladat";
            
            // Átlag számítás
            if(s.revealed && s.taskResults[s.currentTaskIndex]) {
                const vals = s.taskResults[s.currentTaskIndex].filter(v => v && !isNaN(v));
                const avg = vals.reduce((a,b)=>a+parseInt(b),0)/vals.length;
                document.getElementById('avg-display').innerText = avg.toFixed(1);
            } else { document.getElementById('avg-display').innerText = ""; }

            // Előzmények
            const list = document.getElementById('history-list'); list.innerHTML = '';
            s.tasks.forEach((t, i) => {
                let res = s.taskResults[i] ? (s.taskResults[i].filter(v=>!isNaN(v)).reduce((a,b)=>a+parseInt(b),0)/s.taskResults[i].filter(v=>!isNaN(v)).length).toFixed(1) : "-";
                list.innerHTML += `<div>${i+1}. ${t} <b>(${res})</b></div>`;
            });
        });
    </script>
</body>
</html>
