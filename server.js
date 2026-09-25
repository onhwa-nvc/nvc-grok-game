const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '.')));

const DATA_FILE = path.join(__dirname, 'rooms.json');

// 서버 시작 시 기존에 저장된 방 데이터 불러오기
let roomsState = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        roomsState = JSON.parse(data);
        console.log('저장된 방 데이터를 불러왔습니다.');
    } catch (e) {
        console.log('방 데이터 불러오기 실패, 새로 생성합니다.');
    }
}

// 데이터를 파일에 안전하게 저장하는 함수
function saveRoomsData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(roomsState, null, 2));
    } catch (e) {
        console.error('방 데이터 저장 중 오류 발생:', e);
    }
}

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자 ${socket.id}가 ${roomCode} 방에 입장했습니다.`);
        
        // 방이 없으면 기본 생성 후 파일 백업
        if (!roomsState[roomCode]) {
            roomsState[roomCode] = {
                seats: { north: {name:"", occupant:null}, south: {name:"", occupant:null}, west: {name:"", occupant:null}, east: {name:"", occupant:null} },
                cards: { north: {card:"", type:""}, south: {card:"", type:""}, west: {card:"", type:""}, east: {card:"", type:""} },
                gifts: { north: [], south: [], west: [], east: [] },
                selectedActivity: null,
                gameMode: 'private'
            };
            saveRoomsData();
        }
        socket.emit('gameStateUpdate', roomsState[roomCode]);
    });

    socket.on('updateGameState', ({ roomCode, gameState }) => {
        roomsState[roomCode] = gameState;
        saveRoomsData(); // 상태가 바뀔 때마다 즉시 파일에 저장!
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
