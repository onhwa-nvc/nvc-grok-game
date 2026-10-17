const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    path: '/socket.io',
    transports: ['websocket', 'polling']
});

// HTML, CSS 등 웹 파일들이 있는 폴더 경로 설정
app.use(express.static(path.join(__dirname)));

// 방들의 상태를 기억하는 공간
let rooms = {};

io.on('connection', (socket) => {
    console.log('사용자가 연결되었습니다:', socket.id);

    // 1. 관리자 모드에서 새 방을 만들 때 기존 방들을 모두 청소하고 새로 생성
    socket.on('createSpecificRoomWithCleanup', (roomCode) => {
        // 기존에 남아있던 모든 방 정보를 초기화(삭제)합니다.
        rooms = {}; 
        
        // 새로운 방 초기 세팅
        rooms[roomCode] = {
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

        console.log(`새로운 방 생성 완료 (기존 방 모두 정리됨): ${roomCode}`);
        socket.emit('roomCreated', roomCode);
    });

    // 일반 방 생성 (혹시 기존 방식으로 호출될 경우 대비)
    socket.on('createSpecificRoom', (roomCode) => {
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
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
        }
        socket.emit('roomCreated', roomCode);
    });

    // 방이 실제로 존재하는지 확인
    socket.on('checkRoomExists', (roomCode) => {
        const exists = !!rooms[roomCode];
        socket.emit('roomCheckResult', { exists, roomCode });
    });

    // 방 입장
    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        if (rooms[roomCode]) {
            socket.emit('gameStateUpdate', rooms[roomCode]);
        }
    });

    // 게임 상태(카드, 자리 등)가 바뀔 때 모든 사람에게 동기화
    socket.on('updateGameState', ({ roomCode, gameState }) => {
        if (rooms[roomCode]) {
            rooms[roomCode] = gameState;
            io.to(roomCode).emit('gameStateUpdate', gameState);
        }
    });

    // 방장이 방을 직접 종료할 때
    socket.on('destroyRoom', (roomCode) => {
        if (rooms[roomCode]) {
            delete rooms[roomCode];
            io.to(roomCode).emit('roomDestroyed');
            console.log(`방이 종료되었습니다: ${roomCode}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('사용자 연결이 해제되었습니다:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 정상적으로 실행 중입니다: http://localhost:${PORT}`);
});
