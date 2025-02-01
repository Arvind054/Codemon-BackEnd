const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const axios = require('axios');
const io = require("socket.io")(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const { PeerServer } = require('peer'); 
const peerServer = PeerServer({
  path: '/myapp',
  secure:true,
});
app.use('/peerjs', peerServer);
const socketToPeer = new Map();
const Rooms = new Map();
io.on('connection', (socket) => {
  socket.on('join-room', ({ userName, roomId, peerId }) => {
    if(!Rooms.has(roomId)){
      Rooms.set(roomId,new Set());
    }
    if (!socketToPeer.has(socket.id)) {
      socketToPeer.set(socket.id, {peerId:peerId,roomId:roomId});
    }
    Rooms.get(roomId).add(userName);
    socket.join(roomId);
    io.to(roomId).emit('room-update', { peerId,socketId:socket.id});
  });
  socket.on('code-change', ({roomId, code})=>{
      socket.to(roomId).emit("codeUpdate", code);
  });
  socket.on("sync-code", ({socketId, code, newLanguage})=>{
     io.to(socketId).emit("codeUpdate", code);
     io.to(socketId).emit("langChange", newLanguage);
  })
  socket.on("langChange", ({roomId, newLanguage})=>{
    socket.to(roomId).emit("langChange", newLanguage);
  });
  socket.on("ececution-update", async({roomId, code, language,version,stdin})=>{
    const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
      language: language,
      version: version,
      files: [{ content: code }],
      stdin
  });
    if(!response.data.run.stdout){
      io.to(roomId).emit("ececution-update", {output:response.data.run.stderr});
    }else{
    io.to(roomId).emit("ececution-update", {output:response.data.run.stdout});
    }
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
