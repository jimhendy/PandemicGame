const utils = require("./game/utils")
const Game = require('./game/game')

class Pandemic {
    constructor(io) {
        this.io = io;
        this.gameId = Math.floor(Math.random() * 99999999);
        console.info("Game ID: " + this.gameId);
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
        this.game = null;
        this.initial_deal_complete = false;
        this.initial_clients_deals = 0;
    }

    add_user(data, socket) {
        this.users[data.socketId] = data;
        console.info('Player "' + data.username + '" joining game');
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
        console.info('User has disconnected.');
        if (socket_id in this.users) {
            delete this.users[socket_id];
            // TODO emit user lost?
        }
    }

    assign_role(data) {
        this.users[data.socketId].role = data.role;
        this.io.in(this.gameId).emit('reloadRolesSelection', this._role_choice_data());
    }

    player_waiting(socket_id) {
        this.users[socket_id].ready_to_play = true;
        for (const [key, value] of Object.entries(this.users)) {
            if (!value.ready_to_play)
                return
        }
        this.start_game();
    }

    start_game() {
        this.game = new Game(this.io, this.gameId);
        for (const [key, value] of Object.entries(this.users)) {
            this.game.add_player(value);
        }
        this.io.in(this.gameId).emit('startGame', this._role_choice_data());
        this.game.initial_game_setup();
    }

    clientNotesPlayerCardsReceived() {
        if (!this.initial_deal_complete) {
            this.initial_clients_deals++;
            if (this.initial_clients_deals != this.game.players.length) {
                return;
            }
        }
        this.game.new_player_turn();
    }

    assess_player_options(data) {
        var player = this.game.current_player;
        var actions = ["drive_ferry", "pass"]
        if (Object.keys(data.player_cards).length) {
            actions.push("direct_flight");
        }
        if (Object.keys(data.player_cards).includes(player.city)) {
            actions.push("charter_flight");
        }
        if (this.game.cities[player.city].total_cubes > 0) {
            actions.push("treat_disease");
        }

        this.io.to(player.socket_id).emit(
            "enableActions",
            {
                actions: actions,
                adjacent_cities: this.game.cities[player.city].adjacent_cities
            })
        this.io.in(this.gameId).emit(
            "updatePlayerTurns", { player: player.player_name, used_actions: this.game.player_used_actions, total_actions: player.actions_per_turn }
        )
    }

    player_drive_ferry(data) {
        this.io.in(this.gameId).emit("logMessage",
            { message: data.data.username + " drives/ferries to " + data.destination }
        )
        this.game.current_player.city = data.destination;
        this.game.move_pawn(this.game.current_player, data.destination)
        this._check_end_of_user_turn(data);
    }

    player_direct_flight(data) {
        this.io.in(this.gameId).emit("logMessage",
            { message: data.data.username + " takes direct flight to " + data.destination }
        )
        this.game.current_player.city = data.destination;
        this.game.move_pawn(this.game.current_player, data.destination)
        this.game.discard_player_card(data, data.destination)
        this._check_end_of_user_turn(data);
    }

    _check_end_of_user_turn(data) {
        this.game.player_used_actions++;
        var player = this.game.current_player;
        if (this.game.player_used_actions >= player.actions_per_turn) {
            this.game.round++;
            this.game.new_player_turn();
        } else {
            this.assess_player_options(data.data);
        }
    }

    discard_player_card(destination) {
        this.game.player_deck.discard(destination);
    }

    treatDisease(data) {
        var player = this.game.current_player;
        var location = player.city;
        this.io.in(this.gameId).emit("logMessage",
            { message: player.player_name + " treats disease in " + location }
        )
        var city = this.game.cities[location];
        city.remove_cube(city.native_disease_colour);
        this._check_end_of_user_turn({data: data});
        this.game.update_infection_count();
    }

}

module.exports = Pandemic