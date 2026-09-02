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
  mode: "me",          // 'me': 나만 보기, 'others': 나만 안보기
  drawerSeat: null,    // 카드를 뽑은 사람의 자리 ('south', 'north', 'east', 'west')
  isRevealed: false
};

// 각 접속자별 자리 정보 저장
let players = {}; 

io.on('connection', (socket) => {
  // 새 접속자 기본 상태 전송
  sendStateToUser(socket);

  // 자리 선택 이벤트
  socket.on('selectSeat', (seat) => {
    players[socket.id] = seat;
    sendStateToAll();
  });

  // 모드 변경
  socket.on('setMode', (mode) => {
    gameState.mode = mode;
    gameState.currentCard = "";
    gameState.drawerSeat = null;
    gameState.isRevealed = false;
    sendStateToAll();
  });

  // 카드 뽑기 (카드를 뽑은 사람의 자리 기록)
  socket.on('drawCard', () => {
    const userSeat = players[socket.id];
    if (!userSeat) return; // 자리를 안 정했으면 실행 안 함

    gameState.currentCard = sampleCards[Math.floor(Math.random() * sampleCards.length)];
    gameState.drawerSeat = userSeat;
    gameState.isRevealed = false;
    sendStateToAll();
  });

  // 카드 공개하기
  socket.on('revealCard', () => {
    gameState.isRevealed = true;
    sendStateToAll();
  });

  // 접속 종료 처리
  socket.on('disconnect', () => {
    delete players[socket.id];
    sendStateToAll();
  });
});

// 전체 유저에게 각자의 시선에 맞는 상태 전송
function sendStateToAll() {
  io.sockets.sockets.forEach((s) => {
    sendStateToUser(s);
  });
}

// 개별 유저 맞춤 화면 데이터 계산 후 전송
function sendStateToUser(socket) {
  const mySeat = players[socket.id] || null;
  
  // 소켓별 전송 데이터 생성
  let userView = {
    mode: gameState.mode,
    isRevealed: gameState.isRevealed,
    drawerSeat: gameState.drawerSeat,
    mySeat: mySeat,
    occupiedSeats: Object.values(players),
    cards: { north: "", south: "", east: "", west: "" }
  };

  if (gameState.currentCard && gameState.drawerSeat) {
    const card = gameState.currentCard;
    const drawer = gameState.drawerSeat;

    ['south', 'north', 'east', 'west'].forEach((seat) => {
      if (seat === drawer) {
        if (gameState.isRevealed) {
          userView.cards[seat] = card;
        } else if (gameState.mode === 'me') {
          // [나만 보기 모드] 카드를 뽑은 당사자 본인에게만 글자 표시
          userView.cards[seat] = (mySeat === drawer) ? card : "???";
        } else if (gameState.mode === 'others') {
          // [나만 안보기 모드] 카드를 뽑은 당사자 제외 다른 사람에게만 글자 표시
          userView.cards[seat] = (mySeat === drawer) ? "???" : card;
        }
      }
    });
  }

  socket.emit('stateUpdate', userView);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
