// add timestamps in front of log messages
require('console-stamp')(console, 'HH:MM:ss.l');

const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const pan = require("./pandemic");

const publicPath = path.join(__dirname, '/../public');
const port = process.env.PORT || 3000;
let app = express();
let server = http.createServer(app);
let io = socketIO(server);

app.use(express.static(publicPath));

server.listen(port, () => {
    console.log('listening on http://localhost:' + port);
});


// Create the game instance
let pandemic = new pan(io);

io.on('connection', (socket) => {
    console.log('A user just connected.');
    bindSocketEvents(socket);
    socket.emit("connected");
});


// Bind user events to game functions
function bindSocketEvents(socket){
    socket.on('disconnect', function(){pandemic.remove_user(socket.id);});
    socket.on('playerJoinAttempt', playerJoinAttempt);
    socket.on('roleChosen', assignPlayerRole);
    socket.on("waiting_for_other_roles", playerWaiting);
}

// Events
function playerJoinAttempt(data) {
    var calling_socket = this;

    if (true || data.passcode == pandemic.gameId) {
        calling_socket.join(pandemic.gameId);
        pandemic.add_user(data, calling_socket);
        //io.sockets.in(data.passcode).emit('playerJoinedRoom', data);
        //calling_socket.emit("userJoinRoom");
    } else {  
        this.emit("clearUserScreen");
        setTimeout(() => { 
            this.emit("error", { message: "Wrong passcode buddy!" }); 
            this.emit("reloadLandingScreen");
        }, 2000);
        
    }
}

function assignPlayerRole(data){
    pandemic.assign_role(data);
}

function playerWaiting(){
    pandemic.player_waiting(this.id);
}