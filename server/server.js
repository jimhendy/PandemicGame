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
    console.info('listening on http://localhost:' + port);
});


// Create the game instance
let pandemic = new pan(io);

io.on('connection', (socket) => {
    console.info('A user just connected.');
    bindSocketEvents(socket);
    socket.emit("connected");
});


// Bind user events to game functions
function bindSocketEvents(socket){
    socket.on('disconnect', ()=>pandemic.remove_user(socket.id));
    socket.on('playerJoinAttempt', playerJoinAttempt);
    socket.on('roleChosen', (data)=>pandemic.assign_role(data));
    socket.on("waiting_for_other_roles", ()=>pandemic.player_waiting(socket.id));
    socket.on("enquireAvailableActions", (data)=>pandemic.assess_player_options(data));
    socket.on("playerCardsReceived", (data)=>pandemic.clientNotesPlayerCardsReceived(data))

    socket.on("player_drive_ferry", (destination)=>pandemic.player_drive_ferry(destination));
    socket.on("player_direct_flight", (destination)=>pandemic.player_direct_flight(destination));
    socket.on("player_shuttle_flight", (destination)=>pandemic.player_shuttle_flight(destination));
    socket.on("player_charter_flight", (data)=>pandemic.player_charter_flight(data));

    socket.on("player_cure", (cards) => pandemic.player_cure(cards));

    socket.on("build_research_station", ()=>pandemic.player_build_research_station())
    socket.on("treatDisease", (data)=>pandemic.player_treatDisease(data));
    socket.on("pass", ()=>pandemic.player_pass());

    socket.on("submitReducePlayerHand", (cards)=>pandemic.reducePlayerCardHand(cards))

    socket.on("shareKnowledgeProposal", (data) => pandemic.player_shareKnowledgeProposal(data))
    socket.on("shareKnowledgeResponse", (data) => pandemic.player_shareKnowledgeResponse(data));

    socket.on("operations_expert_fly_from_research_station", (data) => pandemic.player_fly_using_card(data))

    socket.on("dispatcher_move_request", (data)=>pandemic.dispatcher_move_request(data));
    socket.on("dispatcher_move_response", (data)=>pandemic.dispatcher_move_response(data));
}

// Events
function playerJoinAttempt(data) {
    var calling_socket = this;

    if (true || data.passcode == pandemic.game_id) {
        calling_socket.join(pandemic.game_id);
        pandemic.add_user(data, calling_socket);
    } else {  
        this.emit("clearUserScreen");
        setTimeout(() => { 
            this.emit("error", { message: "Wrong passcode buddy!" }); 
            this.emit("reloadLandingScreen");
        }, 2000);
        
    }
}
