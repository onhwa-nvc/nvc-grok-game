const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

const emotionCards = [
  "감사한", "감동한", "기쁜", "당황스러운", "답답한", "걱정되는", "두려운", "무기력한", "미안한", "반가운",
  "부끄러운", "뿌듯한", "설레는", "슬픈", "안도하는", "억울한", "외로운", "우울한", "자랑스러운", "홀가분한",
  "화난", "편안한", "평화로운", "희망찬", "지루한", "막막한", "섭섭한", "혼란스러운", "좌절한", "후회스러운",
  "부담스러운", "민망한", "괴로운", "불안한", "초조한", "황당한", "유쾌한", "통쾌한", "짜릿한", "신나는",
  "벅찬", "포근한", "든든한", "여유로운", "자유로운", "아쉬운", "허전한", "귀찮은", "서운한", "낙담한",
  "절망적인", "상심한", "무서운", "놀란", "행복한"
];

const needCards = [
  "안전", "존중", "자율성", "연결", "이해", "휴식", "공정함", "성장", "신뢰", "명확함",
  "기여", "평화", "사랑", "소속감", "배려", "건강", "수용", "인정", "표현", "공감",
  "공동체", "의미", "창의성", "성취", "질서", "예측가능성", "재미", "즐거움", "아름다움", "조화",
  "자유", "독립", "도전", "효능감", "안정", "보호", "위로", "친밀함", "협력", "소통",
  "통합", "진실", "정직", "희망", "목적", "공헌", "유대감", "돌봄", "공유", "조율",
  "여유", "자아실현", "학습", "발전", "여가"
];

let gameState = {
  viewMode: "board",
  cardType: "emotion",
  mode: "me",
  currentCard: "",
  drawerSeat: null,
  isRevealed: false,
  gifts: { north: [], south: [], east: [], west: [] }
};

let players = {};

io.on('connection', (socket) => {
  players[socket.id] = { seat: null, name: "참여자" };
  sendStateToUser(socket);

  // 자리 선택 및 변경
  socket.on('selectSeat', ({ seat, name }) => {
    // 자리가 바뀔 때 이전 자리 해제
    players[socket.id] = {
      seat: seat,
      name: name || getSeatDefaultName(seat)
    };
    sendStateToAll();
  });

  // 자리 비우기 (퇴장)
  socket.on('leaveSeat', () => {
    if (players[socket.id]) {
      players[socket.id].seat = null;
      sendStateToAll();
    }
  });

  socket.on('setViewMode', (viewMode) => {
    gameState.viewMode = viewMode;
    sendStateToAll();
  });

  socket.on('setCardType', (type) => {
    gameState.cardType = type;
    resetCardState();
    sendStateToAll();
  });

  socket.on('setMode', (mode) => {
    gameState.mode = mode;
    resetCardState();
    sendStateToAll();
  });

  socket.on('drawCard', () => {
    const user = players[socket.id];
    if (!user || !user.seat) return;

    let list = emotionCards;
    if (gameState.cardType === 'need') list = needCards;
    else if (gameState.cardType === 'both') list = [...emotionCards, ...needCards];

    gameState.currentCard = list[Math.floor(Math.random() * list.length)];
    gameState.drawerSeat = user.seat;
    gameState.isRevealed = false;
    sendStateToAll();
  });

  socket.on('revealCard', () => {
    gameState.isRevealed = true;
    sendStateToAll();
  });

  socket.on('sendGift', ({ targetSeat, cardWord, cardType }) => {
    if (targetSeat && gameState.gifts[targetSeat]) {
      if (gameState.gifts[targetSeat].length < 10) {
        gameState.gifts[targetSeat].push({
          word: cardWord,
          type: cardType || gameState.cardType,
          from: players[socket.id]?.name || "익명"
        });
        sendStateToAll();
      }
    }
  });

  socket.on('clearGifts', () => {
    gameState.gifts = { north: [], south: [], east: [], west: [] };
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
  io.sockets.sockets.forEach((s) => sendStateToUser(s));
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

  let cardList = [];
  if (gameState.cardType === 'emotion') {
    cardList = emotionCards.map(w => ({ word: w, type: 'emotion' }));
  } else if (gameState.cardType === 'need') {
    cardList = needCards.map(w => ({ word: w, type: 'need' }));
  } else {
    cardList = [
      ...emotionCards.map(w => ({ word: w, type: 'emotion' })),
      ...needCards.map(w => ({ word: w, type: 'need' }))
    ];
  }

  let userView = {
    viewMode: gameState.viewMode,
    cardType: gameState.cardType,
    mode: gameState.mode,
    isRevealed: gameState.isRevealed,
    drawerSeat: gameState.drawerSeat,
    mySeat: myData.seat,
    seatNames: seatInfo,
    occupiedSeats: occupiedSeats,
    gifts: gameState.gifts,
    allCards: cardList,
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
