const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

// 이미지 목록 기반 느낌 카드 (총 54개)
const emotionCards = [
  // 욕구가 충족되었을 때 (18개)
  "고맙다", "안심된다", "편안하다", "평온하다", "기운이난다",
  "용기난다", "기대된다", "여유롭다", "홀가분하다", "가슴뭉클하다",
  "따뜻하다", "재미있다", "기쁘다", "뿌듯하다", "신난다",
  "행복하다", "감동받다", "반갑다",
  
  // 욕구가 충족되지 않았을 때 (36개)
  "궁금하다", "우울하다", "괴롭다", "졸리다", "화난다",
  "그립다", "슬프다", "서운하다", "외롭다", "불편하다",
  "두렵다", "겁난다", "걱정된다", "실망하다", "당황스럽다",
  "좌절스럽다", "혼란스럽다", "심심하다", "막막하다", "놀라다",
  "지친다", "무섭다", "짜증난다", "안타깝다", "귀찮다",
  "불안하다", "긴장하다", "아쉽다", "신경쓰인다", "답답하다",
  "민망하다", "쓸쓸하다", "피곤하다", "지루하다", "속상하다",
  "억울하다"
];

// 이미지 목록 기반 욕구 카드 + '인정' 추가 (총 55개)
const needCards = [
  "놀이", "재미", "꿈", "희망", "솔직함",
  "자유·자율성", "감사", "보살핌", "보호", "조화\n(어울리기)",
  "휴식", "잠", "공기\n음식·주거", "선택", "신뢰\n(믿기)",
  "능력", "자신감", "존재감", "창조", "자기표현",
  "혼자만의\n시간과 공간", "배려", "평화", "이해", "수용\n(받아주기)",
  "사랑", "우정", "관심", "평등", "협력",
  "공감\n(마음알아주기)", "축하", "애도\n(슬퍼하기)", "안전", "기여",
  "나눔", "연결·친밀함", "소통", "소속감", "배움",
  "도전", "예측가능성", "일관성", "건강", "운동",
  "여유", "공동체", "편안함", "존중", "도움·지지",
  "보람", "회복", "진실", "성취", "인정"
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

  socket.on('selectSeat', ({ seat, name }) => {
    players[socket.id] = { seat, name: name || getSeatDefaultName(seat) };
    sendStateToAll();
  });

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
        let alreadyGifted = false;
        Object.values(gameState.gifts).forEach(list => {
          if (list.some(g => g.word === cardWord)) alreadyGifted = true;
        });

        if (!alreadyGifted) {
          gameState.gifts[targetSeat].push({
            word: cardWord,
            type: cardType || gameState.cardType,
            from: players[socket.id]?.name || "익명"
          });
          sendStateToAll();
        }
      }
    }
  });

  socket.on('returnGiftCard', ({ fromSeat, cardWord }) => {
    if (fromSeat && gameState.gifts[fromSeat]) {
      gameState.gifts[fromSeat] = gameState.gifts[fromSeat].filter(g => g.word !== cardWord);
      sendStateToAll();
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

  let giftedWords = [];
  Object.values(gameState.gifts).forEach(list => {
    list.forEach(g => giftedWords.push(g.word));
  });

  let cardList = [];
  if (gameState.cardType === 'emotion') {
    cardList = emotionCards.map(w => ({ word: w, type: 'emotion', isGifted: giftedWords.includes(w) }));
  } else if (gameState.cardType === 'need') {
    cardList = needCards.map(w => ({ word: w, type: 'need', isGifted: giftedWords.includes(w) }));
  } else {
    cardList = [
      ...emotionCards.map(w => ({ word: w, type: 'emotion', isGifted: giftedWords.includes(w) })),
      ...needCards.map(w => ({ word: w, type: 'need', isGifted: giftedWords.includes(w) }))
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
