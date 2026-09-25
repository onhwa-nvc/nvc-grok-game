const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const activeRooms = new Set();

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);

    socket.on('createRoom', () => {
        let roomCode;
        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (activeRooms.has(roomCode));

        activeRooms.add(roomCode);
        console.log(`방 생성됨: ${roomCode}`);
        socket.emit('roomCreated', roomCode);
    });

    socket.on('checkRoomExists', (roomCode) => {
        const trimmedCode = roomCode.trim();
        const exists = activeRooms.has(trimmedCode);
        socket.emit('roomCheckResult', { exists, roomCode: trimmedCode });
    });

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자(${socket.id})가 방 [${roomCode}]에 입장했습니다.`);
    });

    socket.on('updateGameState', (data) => {
        const { roomCode, gameState } = data;
        io.to(roomCode).emit('gameStateUpdate', gameState);
    });

    socket.on('destroyRoom', (roomCode) => {
        if (activeRooms.has(roomCode)) {
            activeRooms.delete(roomCode);
            console.log(`방 [${roomCode}]이 방장에 의해 종료되었습니다.`);
            io.to(roomCode).emit('roomDestroyed');
        }
    });

    socket.on('disconnect', () => {
        console.log(`사용자 연결 끊김: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 정상적으로 실행 중입니다.`);
});
