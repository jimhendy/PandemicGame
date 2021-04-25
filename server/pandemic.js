const utils = require("./game/utils")
const Game = require('./game/game')

class Pandemic {
    constructor(io) {
        this.io = io;
        this.game_id = Math.floor(Math.random() * 99999999);
        console.info("Game ID: " + this.game_id);
        this.all_roles = [
            "Contingency Planner",
            "Dispatcher",
            "Medic",
            "Operations Expert",
            "Quarantine Specialist",
            "Researcher",
            "Scientist"
        ]
        this.users = {}; // socket_id to client data
        this.game = null;
        this.initial_deal_complete = false;
        this.initial_clients_deals = 0;
    }

    add_user(data, socket) {
        this.users[data.socket_id] = data;
        console.info('Player "' + data.player_name + '" joining game');
        socket.emit("userJoinRoom", this._role_choice_data());
    }

    _role_choice_data() {
        return {
            assigned_roles: utils.dict_from_objects(
                Object.values(this.users),
                "player_name", "role"
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
        this.users[data.socket_id].role = data.role;
        this.io.in(this.game_id).emit('reloadRolesSelection', this._role_choice_data());
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
        this.game = new Game(this.io, this.game_id);
        for (const [key, value] of Object.entries(this.users)) {
            this.game.add_player(value);
        }
        this.io.in(this.game_id).emit('startGame', this._role_choice_data());
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

    assess_player_options() {
        var player = this.game.current_player;
        var actions = ["drive_ferry", "pass"]
        if (player.player_cards.length > 0) {
            actions.push("direct_flight");
        }
        var has_current_city_card = utils.objects_attribute_contains_value(player.player_cards, "city_name", player.city_name);
        if (has_current_city_card) {
            actions.push("charter_flight");
        }
        if (this.game.cities[player.city_name].total_cubes > 0) {
            actions.push("treat_disease");
        }
        if (has_current_city_card && this.game.n_research_stations < this.game.max_n_research_stations) {
            actions.push("build_research_station");
        }

        this.io.to(player.socket_id).emit(
            "enableActions",
            {
                actions: actions,
                adjacent_cities: this.game.cities[player.city_name].adjacent_cities
            })
        this.io.in(this.game_id).emit(
            "updatePlayerTurns", { player: player.player_name, used_actions: this.game.player_used_actions, total_actions: player.actions_per_turn }
        )
    }

    player_drive_ferry(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " drives/ferries to " + destination_city_name }
        )
        player.move_pawn(this.game.cities[destination_city_name]);
        this._check_end_of_user_turn();
    }

    player_direct_flight(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " takes direct flight to " + destination_city_name }
        )

        player.discard_card(destination_city_name);
        this.game.player_deck.discard([destination_city_name]);

        player.move_pawn(this.game.cities[destination_city_name]);

        this._check_end_of_user_turn();
    }

    _check_end_of_user_turn() {
        this.game.player_used_actions++;
        var player = this.game.current_player;
        if (this.game.player_used_actions >= player.actions_per_turn) {
            this.game.round++;
            this.game.player_deck.drawPlayerCards(2, player);
            if (player.player_cards.length > player.max_hand_cards) {
                this.io.to(player.socket_id).emit(
                    "reducePlayerHand",
                    {
                        max_cards: player.max_hand_cards,
                        current_cards: utils.array_from_objects_list(player.player_cards, "card_name")
                    }
                );
            } else {
                this.infect_cities();
                this.game.new_player_turn();
            }
        } else {
            this.assess_player_options();
        }
        // TODO Test for game won/lost
    }

    infect_cities() {
        this.game.infect_cities();
    }

    reducePlayerCardHand(cards) {
        for (const c of cards) {
            this.game.current_player.discard_card(c);
        }
        this.game.player_deck.discard(cards);
        this.infect_cities();
        this.game.new_player_turn();
    }

    treatDisease() {
        var player = this.game.current_player;
        var city_name = player.city_name;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " treats disease in " + city_name }
        )
        var city = this.game.cities[city_name];
        city.remove_cube(city.native_disease_colour);
        this._check_end_of_user_turn();
        this.game.update_infection_count();
    }

    pass() {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " is too scared to do anything and passes" }
        )
        this.game.player_used_actions = player.actions_per_turn + 1;
        this._check_end_of_user_turn();
    }

}

module.exports = Pandemic