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
        console.log('불러온 방 목록:', Object.keys(roomsState));
    } catch (e) {
        console.log('방 데이터 파일 읽기 실패, 새로 시작합니다.');
    }
}

// 방 데이터를 파일에 안전하게 즉시 저장하는 함수
function saveRoomsData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(roomsState, null, 2));
    } catch (e) {
        console.error('방 데이터 저장 오류:', e);
    }
}

io.on('connection', (socket) => {
    console.log('사용자 접속:', socket.id);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자 ${socket.id}가 ${roomCode} 방에 입장 시도.`);

        // 만약 메모리에는 없지만 이미 생성된 적이 있는 방이라면 파일에서 다시 로드
        if (!roomsState[roomCode] && fs.existsSync(DATA_FILE)) {
            try {
                const freshData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                if (freshData[roomCode]) {
                    roomsState[roomCode] = freshData[roomCode];
                    console.log(`[복구 완료] 파일에서 ${roomCode} 방 데이터를 복구했습니다.`);
                }
            } catch (e) {}
        }

        // 여전히 방이 없다면 새로 생성하고 파일에 영구 백업
        if (!roomsState[roomCode]) {
            roomsState[roomCode] = {
                seats: { north: {name:"", occupant:null}, south: {name:"", occupant:null}, west: {name:"", occupant:null}, east: {name:"", occupant:null} },
                cards: { north: {card:"", type:""}, south: {card:"", type:""}, west: {card:"", type:""}, east: {card:"", type:""} },
                gifts: { north: [], south: [], west: [], east: [] },
                selectedActivity: null,
                gameMode: 'private'
            };
            saveRoomsData();
            console.log(`[신규 생성] ${roomCode} 방이 생성되고 파일에 저장되었습니다.`);
        }

        // 현재 방 상태를 접속한 기기로 전송
        socket.emit('gameStateUpdate', roomsState[roomCode]);
    });

    socket.on('updateGameState', ({ roomCode, gameState }) => {
        roomsState[roomCode] = gameState;
        saveRoomsData(); // 상태가 바뀔 때마다 파일에 즉시 반영
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
