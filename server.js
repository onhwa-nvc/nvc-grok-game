// 방 상태에 isLocked 변수 추가
function createInitialState() {
  return {
    isLocked: false, // 방 잠금 상태 (true면 종료됨)
    viewMode: 'board',
    // ... 기존 상태들
  };
}

io.on('connection', (socket) => {
  const roomId = socket.handshake.query.room || 'default';
  if (!rooms[roomId]) rooms[roomId] = createInitialState();
  
  const state = rooms[roomId];

  // 이미 잠긴 방이면 접속 즉시 차단 메시지 전송
  if (state.isLocked) {
    socket.emit('roomClosed');
    return;
  }

  socket.join(roomId);
  socket.emit('stateUpdate', state);

  // 방장이 '모임 종료(잠금)' 버튼을 눌렀을 때
  socket.on('closeRoom', () => {
    state.isLocked = true; // 방 상태를 잠금으로 변경
    io.to(roomId).emit('roomClosed'); // 접속한 모든 인원에게 종료 신호 전송
  });

  // ... 기존 소켓 이벤트들
});
