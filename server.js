const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let gameState = {
  isClosed: false,
  viewMode: 'board',
  cardType: 'emotion',
  mode: 'me',
  cards: { south: "", north: "", east: "", west: "" },
  gifts: { south: [], north: [], east: [], west: [] },
  occupiedSeats: [],
  seatNames: { south: "", north: "", east: "", west: "" },
  allCards: []
};

const closedHtml = `
<!DOCTYPE html>
<html lang="ko" class="notranslate" translate="no">
<head>
  <meta charset="UTF-8">
  <meta name="google" content="notranslate">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>모임 종료</title>
</head>
<body style="background-color: #f4f1ea; font-family: sans-serif; display: flex; height: 100vh; justify-content: center; align-items: center; margin: 0;">
  <div style="text-align: center; padding: 25px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #5d4037; font-size: 20px; margin-bottom: 10px;">🔒 모임이 종료되었습니다</h1>
    <p style="color: #666; font-size: 14px; line-height: 1.5;">
      오늘 NVC 그로그 카드 놀이에 참여해 주셔서 감사합니다.<br>
      현재 모임이 종료되어 더 이상 이용하실 수 없습니다.
    </p>
  </div>
</body>
</html>
`;

app.use((req, res, next) => {
  if (gameState.isClosed) {
    return res.send(closedHtml);
  }
  next();
});

app.use(express.static('public'));

const EMOTION_WORDS = [
  "걱정되는", "답답한", "두려운", "부담스러운", "불안한", "서운한", "속상한", "슬픈",
  "외로운", "우울한", "억울한", "지친", "화난", "당황스러운", "미안한", "부끄러운",
  "놀란", "무서운", "막막한", "혼란스러운", "아쉬운", "절망적인", "피곤한", "무기력한",
  "괴로운", "불편한", "어색한", "야속한", "허전한", "냉담한", "막연한", "초조한",
  "기쁜", "반가운", "설레는", "감사한", "편안한", "행복한", "든든한", "뿌듯한",
  "희망찬", "자유로운", "감동적인", "평화로운", "신나는", "활기찬", "후련한", "만족스러운",
  "따뜻한", "친근한", "홀가분한", "자신있는", "유쾌한", "사랑스러운", "안도하는", "상쾌한",
  "흥미로운", "호기심나는", "충만한", "연민을느끼는", "자랑스러운", "황홀한", "아늑한", "편안한"
];

const NEED_WORDS = [
  "자율성", "선택", "자유", "꿈", "목표", "공간", "독립",
  "축하", "애도", "기억", "성찰", "명예",
  "진실성", "진정성", "창의성", "자기형성", "자존감", "의미",
  "상호의존", "수용", "전달", "공감", "사랑", "소속감", "배려", "친밀함", "존중", "지지", "신뢰", "이해", "협동", "안전", "연결", "소통",
  "놀이", "재미", "즐거움", "휴식", "유머",
  "영적연결", "아름다움", "조화", "평화", "질서", "영감",
  "신체적생존", "공기", "음식", "물", "주거", "운동", "휴식", "안전", "보호", "접촉"
];

function rebuildAllCards() {
  let list = [];
  if (gameState.cardType === 'emotion') {
    list = EMOTION_WORDS.map(w => ({ word: w, type: 'emotion', isGifted: false }));
  } else if (gameState.cardType === 'need') {
    list = NEED_WORDS.map(w => ({ word: w, type: 'need', isGifted: false }));
  } else if (gameState.cardType === 'both') {
    const ems = EMOTION_WORDS.map(w => ({ word: w, type: 'emotion', isGifted: false }));
    const nds = NEED_WORDS.map(w => ({ word: w, type: 'need', isGifted: false }));
    list = ems.concat(nds);
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  gameState.allCards = list;
}

rebuildAllCards();

function sendStateToAll() {
  io.sockets.sockets.forEach((socket) => {
    let mySeat = socket.seat || null;
    let clientCards = { ...gameState.cards };

    if (gameState.mode === 'me') {
      ['south', 'north', 'east', 'west'].forEach(seat => {
        if (seat !== mySeat && clientCards[seat] && clientCards[seat] !== "") {
          clientCards[seat] = "???";
        }
      });
    } else if (gameState.mode === 'others') {
      if (mySeat && clientCards[mySeat] && clientCards[mySeat] !== "") {
        clientCards[mySeat] = "???";
      }
    }

    socket.emit('stateUpdate', {
      ...gameState,
      cards: clientCards,
      mySeat: mySeat
    });
  });
}

io.on('connection', (socket) => {
  socket.seat = null;

  if (gameState.isClosed) {
    socket.emit('roomClosed');
    return;
  }

  sendStateToAll();

  socket.on('closeRoom', () => {
    gameState.isClosed = true;
    io.emit('roomClosed');
  });

  // [게임 초기화 이벤트] 모든 카드, 선물 슬롯, 카드 덱 상태를 초기화
  socket.on('resetGame', () => {
    gameState.cards = { south: "", north: "", east: "", west: "" };
    gameState.gifts = { south: [], north: [], east: [], west: [] };
    rebuildAllCards();
    sendStateToAll();
  });

  socket.on('selectSeat', (data) => {
    if (gameState.isClosed) return;
    const { seat, name } = data;
    if (gameState.occupiedSeats.includes(seat)) return;
    
    gameState.occupiedSeats.push(seat);
    gameState.seatNames[seat] = name || getSeatLabel(seat);
    socket.seat = seat;
    sendStateToAll();
  });

  socket.on('leaveSeat', () => {
    if (socket.seat) {
      const s = socket.seat;
      gameState.occupiedSeats = gameState.occupiedSeats.filter(item => item !== s);
      gameState.seatNames[s] = "";
      socket.seat = null;
      sendStateToAll();
    }
  });

  socket.on('setViewMode', (mode) => {
    gameState.viewMode = mode;
    sendStateToAll();
  });

  socket.on('setCardType', (type) => {
    gameState.cardType = type;
    gameState.cards = { south: "", north: "", east: "", west: "" };
    gameState.gifts = { south: [], north: [], east: [], west: [] };
    rebuildAllCards();
    sendStateToAll();
  });

  socket.on('setMode', (mode) => {
    gameState.mode = mode;
    sendStateToAll();
  });

  socket.on('drawCard', () => {
    let targetSeat = socket.seat;
    if (!targetSeat) {
      if (gameState.occupiedSeats.length > 0) {
        targetSeat = gameState.occupiedSeats[0];
      } else {
        targetSeat = 'south';
      }
    }

    let wordList = EMOTION_WORDS;
    if (gameState.cardType === 'need') wordList = NEED_WORDS;
    else if (gameState.cardType === 'both') wordList = EMOTION_WORDS.concat(NEED_WORDS);

    const randIndex = Math.floor(Math.random() * wordList.length);
    
    gameState.cards = { south: "", north: "", east: "", west: "" };
    gameState.cards[targetSeat] = wordList[randIndex];
    
    if (gameState.mode === 'reveal') {
      gameState.mode = 'me';
    }
    
    sendStateToAll();
  });

  socket.on('revealCard', () => {
    gameState.mode = 'reveal';
    sendStateToAll();
  });

  socket.on('sendGift', (data) => {
    const { targetSeat, cardWord, cardType } = data;
    const cardObj = gameState.allCards.find(c => c.word === cardWord);
    if (cardObj && !cardObj.isGifted) {
      cardObj.isGifted = true;
      if (!gameState.gifts[targetSeat]) gameState.gifts[targetSeat] = [];
      gameState.gifts[targetSeat].push({ word: cardWord, type: cardType });
      sendStateToAll();
    }
  });

  socket.on('returnGiftCard', (data) => {
    const { fromSeat, cardWord } = data;
    if (gameState.gifts[fromSeat]) {
      gameState.gifts[fromSeat] = gameState.gifts[fromSeat].filter(c => c.word !== cardWord);
      const cardObj = gameState.allCards.find(c => c.word === cardWord);
      if (cardObj) cardObj.isGifted = false;
      sendStateToAll();
    }
  });

  socket.on('disconnect', () => {
    if (socket.seat) {
      const s = socket.seat;
      gameState.occupiedSeats = gameState.occupiedSeats.filter(item => item !== s);
      gameState.seatNames[s] = "";
      sendStateToAll();
    }
  });
});

function getSeatLabel(s) {
  const labels = { south: "남쪽", north: "북쪽", east: "동쪽", west: "서쪽" };
  return labels[s] || s;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
