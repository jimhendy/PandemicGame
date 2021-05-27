// add timestamps in front of log messages
require('console-stamp')(console, 'HH:MM:ss.l');

const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const pan = require("./pandemic");
const utils = require("./game/utils")

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
    //socket.on("playerCardsReceived", (data)=>pandemic.clientNotesPlayerCardsReceived(data))
    socket.on("action_complete", ()=>pandemic.action_complete());
    socket.on("action_response", (data)=>pandemic.action_response(data));

    socket.on("event_card_clicked", (data)=>pandemic.player_play_event_card(data));
    socket.on("change_n_epidemic_cards", (data)=>pandemic.set_number_of_epidemic_cards(data));
    socket.on("tell_me_n_epidemics", ()=>{
        pandemic.io.to(socket.id).emit("clientAction", {function: "incoming_change_n_epidemic_cards", args: pandemic.n_epidemics});
    })
}

// Events
function playerJoinAttempt(data) {
    var calling_socket = this;
    
    if (data.passcode == '26111987Ali' && data.player_name == "Jim"){
        console.log("Restarting game")
        pandemic = new pan(io); 
        io.emit("reloadPage");
    } else if (utils.objects_attribute_contains_value(Object.values(pandemic.users), "player_name", data.player_name)){
        calling_socket.emit("clearUserScreen");
        setTimeout(() => { 
            calling_socket.emit("error", { message: "Username already taken" }); 
            calling_socket.emit("reloadLandingScreen");
        }, 1000);
    } else if (data.passcode == pandemic.game_id) {
        calling_socket.join(pandemic.game_id);
        pandemic.add_user(data, calling_socket);
    } else {  
        calling_socket.emit("clearUserScreen");
        setTimeout(() => { 
            calling_socket.emit("error", { message: "Wrong passcode buddy!" }); 
            calling_socket.emit("reloadLandingScreen");
        }, 2000);
        
    }
}
