const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const { PeerServer } = require('peer'); 
const peerServer = PeerServer({
  port: 9000, 
  path: '/myapp',
  ssl: false, 
});
const socketToPeer = new Map();
const Rooms = new Map();

const RoomIdtoCode = new Map();
io.on('connection', (socket) => {
  socket.on('join-room', ({ userName, roomId, peerId }) => {
    if(!Rooms.has(roomId)){
      Rooms.set(roomId,new Set());
      RoomIdtoCode.set(roomId,[]);
    }
    if (!socketToPeer.has(socket.id)) {
      socketToPeer.set(socket.id, {peerId:peerId,roomId:roomId});
    }
    Rooms.get(roomId).add(userName);
    socket.join(roomId);
    io.to(roomId).emit('room-update', { peerId });
  });
  socket.on('code-change', ({roomId, code})=>{
       RoomIdtoCode.set(roomId, code);
      socket.to(roomId).emit("codeUpdate", code);
  });
  socket.on("langChange", ({roomId, newLanguage})=>{
    socket.to(roomId).emit("langChange", newLanguage);
  });
  socket.on('leaveRoom', ()=>{
    if (socket) {
      const data = socketToPeer.get(socket.id);
      if(data){
      const peerId = data.peerId;
      const roomId = data.roomId;
      if (peerId && roomId) {
        socketToPeer.delete(socket.id);
        io.to(roomId).emit('user-left', { peerId });
      }
    }
    }
  });
  socket.on("code-sync", ({roomId})=>{
     if(RoomIdtoCode.has(roomId)){
      const code = RoomIdtoCode.get(roomId);
      socket.to(roomId).emit('code-sync', code);
     }
  })
  socket.on('disconnect', () => {
    if (socket) {
      const data = socketToPeer.get(socket.id);
      if(data){
      const peerId = data.peerId;
      const roomId = data.roomId;
      if (peerId && roomId) {
        socketToPeer.delete(socket.id);
        io.to(roomId).emit('user-left', { peerId });
      }

    }
    }
  });

});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
