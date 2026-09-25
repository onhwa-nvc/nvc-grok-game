const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 제공 경로 설정
app.use(express.static(path.join(__dirname, '.')));

const roomsState = {};

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자 ${socket.id}가 ${roomCode} 방에 입장했습니다.`);

        if (roomsState[roomCode]) {
            socket.emit('gameStateUpdate', roomsState[roomCode]);
        }
    });

    socket.on('updateGameState', ({ roomCode, gameState }) => {
        roomsState[roomCode] = gameState;
        io.to(roomCode).emit('gameStateUpdate', gameState);
    });

    socket.on('disconnect', () => {
        console.log('사용자 연결 해제:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
