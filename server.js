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

// 정적 파일 제공 (index.html, game.html 등이 위치한 폴더 지정)
app.use(express.static(path.join(__dirname)));

// 현재 활성화된 방 목록을 관리하는 Set
const activeRooms = new Set();

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);

    // 1. 방장이 새 방을 생성할 때
    socket.on('createRoom', () => {
        // 4자리 랜덤 방 코드 생성 (중복 방지 루프)
        let roomCode;
        do {
            roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        } while (activeRooms.has(roomCode));

        activeRooms.add(roomCode);
        console.log(`방 생성됨: ${roomCode}`);
        socket.emit('roomCreated', roomCode);
    });

    // 2. 참여자가 입력한 방 코드가 유효한지 확인
    socket.on('checkRoomExists', (roomCode) => {
        const trimmedCode = roomCode.trim();
        const exists = activeRooms.has(trimmedCode);
        socket.emit('roomCheckResult', { exists, roomCode: trimmedCode });
    });

    // 3. 게임방 입장 (Socket.io 룸 조인)
    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        console.log(`사용자(${socket.id})가 방 [${roomCode}]에 입장했습니다.`);
    });

    // 4. 게임 상태 동기화 (카드 뽑기, 착석, 선물 등)
    socket.on('updateGameState', (data) => {
        const { roomCode, gameState } = data;
        // 해당 방에 있는 모든 유저에게 최신 상태 전송
        io.to(roomCode).emit('gameStateUpdate', gameState);
    });

    // 5. 방장이 방을 폭파(종료)할 때
    socket.on('destroyRoom', (roomCode) => {
        if (activeRooms.has(roomCode)) {
            activeRooms.delete(roomCode);
            console.log(`방 [${roomCode}]이 방장에 의해 종료(폭파)되었습니다.`);
            // 해당 방에 있는 모든 참가자에게 강제 퇴장 신호 전송
            io.to(roomCode).emit('roomDestroyed');
        }
    });

    // 6. 연결 끊김 처리 (브라우저 종료 등)
    socket.on('disconnect', () => {
        console.log(`사용자 연결 끊김: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 정상적으로 실행 중입니다.`);
});
