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

// 활성화된 방 목록과 방별 게임 상태를 관리하는 저장소
const activeRooms = new Set();
const roomStates = {}; 

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);

    // 관리자가 지정한 코드로 새 방 생성 (재사용 가능하도록 기존 잔여 데이터 클린업 포함)
    socket.on('createSpecificRoom', (roomCode) => {
        const trimmedCode = roomCode.trim();
        
        // 혹시라도 남아있을 수 있는 유령 데이터 강제 청소
        activeRooms.delete(trimmedCode);
        delete roomStates[trimmedCode];

        activeRooms.add(trimmedCode);
        socket.join(trimmedCode);
        
        // 방 초기 게임 상태 설정
        roomStates[trimmedCode] = {
            seats: { 
                north: { name: "", occupant: null }, 
                south: { name: "", occupant: null }, 
                west: { name: "", occupant: null }, 
                east: { name: "", occupant: null } 
            },
            cards: { 
                north: { card: "", type: "", revealed: false, selfRevealed: false }, 
                south: { card: "", type: "", revealed: false, selfRevealed: false }, 
                west: { card: "", type: "", revealed: false, selfRevealed: false }, 
                east: { card: "", type: "", revealed: false, selfRevealed: false } 
            },
            gifts: { north: [], south: [], west: [], east: [] },
            selectedActivity: null,
            gameMode: 'private'
        };

        console.log(`[방 생성 완료] 코드: ${trimmedCode}`);
        socket.emit('roomCreated', trimmedCode);
    });

    // 방 존재 여부 확인
    socket.on('checkRoomExists', (roomCode) => {
        const trimmedCode = roomCode.trim();
        const exists = activeRooms.has(trimmedCode);
        socket.emit('roomCheckResult', { exists, roomCode: trimmedCode });
    });

    // 게임방 입장 시 최신 상태 동기화
    socket.on('joinRoom', (roomCode) => {
        const trimmedCode = roomCode.trim();
        socket.join(trimmedCode);
        console.log(`사용자(${socket.id})가 방 [${trimmedCode}]에 입장했습니다.`);
        
        if (roomStates[trimmedCode]) {
            socket.emit('gameStateUpdate', roomStates[trimmedCode]);
        }
    });

    // 게임 상태 업데이트
    socket.on('updateGameState', (data) => {
        const { roomCode, gameState } = data;
        if (roomCode && roomStates[roomCode]) {
            roomStates[roomCode] = gameState;
        }
        io.to(roomCode).emit('gameStateUpdate', gameState);
    });

    // 방장이 방을 명시적으로 종료(폭파)할 때
    socket.on('destroyRoom', (roomCode) => {
        const trimmedCode = roomCode.trim();
        if (activeRooms.has(trimmedCode)) {
            activeRooms.delete(trimmedCode);
            delete roomStates[trimmedCode];
            console.log(`[방 폭파 완료] 코드: ${trimmedCode}`);
            io.to(trimmedCode).emit('roomDestroyed');
        }
    });

    socket.on('disconnect', () => {
        console.log(`사용자 연결 끊김: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 정상적으로 실행 중입니다.`);
});
