const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '.')));

// 기본 테스트 방을 미리 등록하여 '존재하지 않는 방' 오류 방지
const roomsState = {
    "1234": {
        seats: { north: {name:"", occupant:null}, south: {name:"", occupant:null}, west: {name:"", occupant:null}, east: {name:"", occupant:null} },
        cards: { north: {card:"", type:""}, south: {card:"", type:""}, west: {card:"", type:""}, east: {card:"", type:""} },
        gifts: { north: [], south: [], west: [], east: [] },
        selectedActivity: null,
        gameMode: 'private'
    }
};

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자 ${socket.id}가 ${roomCode} 방에 입장했습니다.`);
        
        // 방이 없으면 기본 상태로 자동 생성
        if (!roomsState[roomCode]) {
            roomsState[roomCode] = {
                seats: { north: {name:"", occupant:null}, south: {name:"", occupant:null}, west: {name:"", occupant:null}, east: {name:"", occupant:null} },
                cards: { north: {card:"", type:""}, south: {card:"", type:""}, west: {card:"", type:""}, east: {card:"", type:""} },
                gifts: { north: [], south: [], west: [], east: [] },
                selectedActivity: null,
                gameMode: 'private'
            };
        }
        socket.emit('gameStateUpdate', roomsState[roomCode]);
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
