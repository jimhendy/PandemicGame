const utils = require("./utils")

class Pandemic {
    constructor(io) {
        this.io = io;
        this.gameId = Math.floor(Math.random() * 99999999);
        console.log("Game ID: " + this.gameId);
        this.all_roles = [
            "Contingency Planner",
            "Dispatcher",
            "Medic",
            "Operations Expert",
            "Quarantine Specialist",
            "Researcher",
            "Scientist"
        ]
        this.users = {}; // socketId to client data
    }

    add_user(data, socket) {
        this.users[data.socketId] = data;
        console.log('Player "' + data.username + '" joining game');
        socket.emit("userJoinRoom", this._role_choice_data());
    }

    _role_choice_data() {
        return {
            assigned_roles: utils.dict_from_objects(
                Object.values(this.users),
                "username", "role"
            ),
            all_roles: this.all_roles
        }
    }

    remove_user(socket_id) {
        console.log('User has disconnected.');
        if (socket_id in this.users) {
            delete this.users[socket_id];
            // TODO emit user lost?
        }
    }

    assign_role(data) {
        this.users[data.socketId].role = data.role;
        this.io.in(this.gameId).emit('reloadRolesSelection', this._role_choice_data());
    }

    player_waiting(socket_id){
        this.users[socket_id].ready_to_play = true;
        for (const [key, value] of Object.entries(this.users)) {
            if (!value.ready_to_play)
                return
        }
        console.log("starting game")
        this.io.in(this.gameId).emit('startGame', this._role_choice_data());
    }
}

module.exports = Pandemic