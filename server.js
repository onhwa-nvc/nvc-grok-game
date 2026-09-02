const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

// NVC 단어 데이터
const emotionCards = ["설레는", "답답한", "감사한", "평화로운", "걱정되는", "뿌듯한", "무기력한", "홀가분한", "당황스러운", "안도하는", "슬픈", "기쁜"];
const needCards = ["안전", "존중", "자율성", "연결", "이해", "휴식", "공정함", "성장", "신뢰", "명확함", "기여", "평화"];

let gameState = {
  cardType: "emotion", // 'emotion'(느낌) 또는 'need'(욕구)
  mode: "me",          // 'me'(나만 보기) 또는 'others'(나만 안보기)
  currentCard: "",
  drawerSeat: null,    // 카드를 뽑은 사람의 자리
  isRevealed: false
};

let players = {}; 

io.on('connection', (socket) => {
  players[socket.id] = { seat: null, name: "참여자" };
  sendStateToUser(socket);

  // 자리 선택 및 이름 설정
  socket.on('selectSeat', ({ seat, name }) => {
    players[socket.id] = { 
      seat: seat, 
      name: name || getSeatDefaultName(seat) 
    };
    sendStateToAll();
  });

  // 카드 종류 변경 (느낌/욕구)
  socket.on('setCardType', (type) => {
    gameState.cardType = type;
    resetCardState();
    sendStateToAll();
  });

  // 모드 변경 (나만 보기/나만 안보기)
  socket.on('setMode', (mode) => {
    gameState.mode = mode;
    resetCardState();
    sendStateToAll();
  });

  // 카드 뽑기
  socket.on('drawCard', () => {
    const user = players[socket.id];
    if (!user || !user.seat) return;

    const list = gameState.cardType === 'emotion' ? emotionCards : needCards;
    gameState.currentCard = list[Math.floor(Math.random() * list.length)];
    gameState.drawerSeat = user.seat;
    gameState.isRevealed = false;
    sendStateToAll();
  });

  // 정답 공개하기
  socket.on('revealCard', () => {
    gameState.isRevealed = true;
    sendStateToAll();
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    sendStateToAll();
  });
});

function resetCardState() {
  gameState.currentCard = "";
  gameState.drawerSeat = null;
  gameState.isRevealed = false;
}

function getSeatDefaultName(seat) {
  const names = { south: "남쪽", north: "북쪽", east: "동쪽", west: "서쪽" };
  return names[seat] || "참여자";
}

function sendStateToAll() {
  io.sockets.sockets.forEach((s) => {
    sendStateToUser(s);
  });
}

function sendStateToUser(socket) {
  const myData = players[socket.id] || { seat: null, name: "" };
  
  let seatInfo = { north: "북쪽", south: "남쪽", east: "동쪽", west: "서쪽" };
  let occupiedSeats = [];

  Object.values(players).forEach(p => {
    if (p.seat) {
      seatInfo[p.seat] = p.name;
      occupiedSeats.push(p.seat);
    }
  });

  let userView = {
    cardType: gameState.cardType,
    mode: gameState.mode,
    isRevealed: gameState.isRevealed,
    drawerSeat: gameState.drawerSeat,
    mySeat: myData.seat,
    seatNames: seatInfo,
    occupiedSeats: occupiedSeats,
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
          userView.cards[seat] = (myData.seat === drawer) ? card : "???";
        } else if (gameState.mode === 'others') {
          userView.cards[seat] = (myData.seat === drawer) ? "???" : card;
        }
      }
    });
  }

  socket.emit('stateUpdate', userView);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
