const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

const sampleCards = ["설레는", "답답한", "감사한", "평화로운", "걱정되는", "뿌듯한", "무기력한", "홀가분한", "당황스러운", "안도하는"];

let gameState = {
  currentCard: "",
  mode: "me",
  isRevealed: false
};

io.on('connection', (socket) => {
  socket.emit('stateUpdate', gameState);

  socket.on('setMode', (mode) => {
    gameState.mode = mode;
    gameState.currentCard = "";
    gameState.isRevealed = false;
    io.emit('stateUpdate', gameState);
  });

  socket.on('drawCard', () => {
    gameState.currentCard = sampleCards[Math.floor(Math.random() * sampleCards.length)];
    gameState.isRevealed = false;
    io.emit('stateUpdate', gameState);
  });

  socket.on('revealCard', () => {
    gameState.isRevealed = true;
    io.emit('stateUpdate', gameState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
