// add timestamps in front of log messages
require('console-stamp')(console, 'HH:MM:ss.l');

const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const auth = require("./auth");
const Lobby = require("./lobby");

const publicPath = path.join(__dirname, '/../public');
const port = process.env.PORT || 3000;

let app = express();
let server = http.createServer(app);
let io = socketIO(server, {
    allowRequest: (req, callback) => callback(null, auth.isAuthorised(req) && auth.playerId(req) != null)
});

auth.protect(app);
// The games list and each game (/g/<id>) are the same page
app.get(['/', '/g/:id'], (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.use(express.static(publicPath));

// Keep the other games running if one hits a bug
process.on('unhandledRejection', (err) => console.error('Unhandled rejection', err));

let lobby = new Lobby(io);
io.on('connection', (socket) => lobby.connect(socket, auth.playerId(socket.request)));

server.listen(port, () => {
    console.info('listening on http://localhost:' + port);
});
