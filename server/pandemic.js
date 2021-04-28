const utils = require("./game/utils")
const Game = require('./game/game');
const { objects_attribute_contains_value } = require("./game/utils");

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
        if (Object.keys(this.users).includes(socket_id)) {
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
        var city_name = player.city_name;
        var city = this.game.cities[city_name];

        var actions = ["drive_ferry", "pass"]

        if (player.player_cards.length > 0) {
            actions.push("direct_flight");
        }
        var has_current_city_card = utils.objects_attribute_contains_value(player.player_cards, "city_name", player.city_name);
        if (has_current_city_card) {
            actions.push("charter_flight");
        }
        if (city.total_cubes > 0) {
            actions.push("treat_disease");
        }
        if (
            has_current_city_card
            &&
            this.game.n_research_stations < this.game.max_n_research_stations
            &&
            !this.game.research_station_cities.includes(city_name)
        ) {
            actions.push("build_research_station");
        }
        if (city.has_research_station && this.game.n_research_stations > 1)
            actions.push("shuttle_flight")

        var players_in_same_city = [];
        for (const p of this.game.players){
            if (p === player) continue;
            if (p.city_name == city_name){
                players_in_same_city.push(p)
            }
        }
        var share_knowledge_data = [];
        if (players_in_same_city.length){
            if (has_current_city_card){
                // Can trade this with ANY other player in same city
                actions.push("share_knowledge")
                for (const p of players_in_same_city){
                    share_knowledge_data.push({
                        other_player: p.player_name,
                        card: city_name,
                        direction: "Give"
                    })
                }
            } else {
                // require other player to have this card
                var players_with_current_city = [];
                for (const p of players_in_same_city){
                    if (utils.objects_attribute_contains_value(p.player_cards, "city_name", city_name))
                        players_with_current_city.push(p)
                }
                if (players_with_current_city.length > 1){
                    console.error("Two players have the same card!")
                    console.error(players_with_current_city)
                    console.error(city_name)
                }
                if (players_with_current_city.length)
                    actions.push("share_knowledge")
                for (const p of players_with_current_city){
                    share_knowledge_data.push({
                        other_player: p.player_name,
                        card: city_name,
                        direction: "Take"
                    })
                }

            }
            // Researcher special action
            if (player.role_name == "Researcher"){
                for (const c of player.player_cards){
                    if (!c.is_city || c.card_name == city_name) 
                        continue // Current city already included from above
                    if (!actions.includes("share_knowledge")) // Need to test here to avoid trying to trade event cards
                        actions.push("share_knowledge")
                    for (const p of players_in_same_city){
                        share_knowledge_data.push({
                            other_player: p.player_name,
                            card: c.card_name,
                            direction: "Give"
                        })
                    }
                }
            } else {
                // Some other player may be researcher
                for (const p of players_in_same_city){
                    if (p.role_name == "Researcher"){
                        for (const c of p.player_cards){
                            if (!c.is_city || c.card_name == city_name) 
                                continue // Current city already included from above
                            if (!actions.includes("share_knowledge")) // Need to test here to avoid trying to trade event cards
                                actions.push("share_knowledge")
                            share_knowledge_data.push({
                                other_player: p.player_name,
                                card: c.card_name,
                                direction: "Take"
                            })
                        }
                    }
                }
            }
        }

        

        var colours_that_can_be_cured = null;
        if (city.has_research_station) {
            colours_that_can_be_cured = this._curable_colours();
            if (Object.keys(colours_that_can_be_cured).length) {
                actions.push("cure");
            }
        }

        this.io.to(player.socket_id).emit(
            "enableActions",
            {
                actions: actions,
                adjacent_cities: city.adjacent_cities,
                research_station_cities: this.game.research_station_cities,
                curable_colours: colours_that_can_be_cured,
                n_cards_to_cure: player.n_cards_to_cure,
                current_city_cubes: city.disease_cubes,
                share_knowledge_data: share_knowledge_data
            })
        this.io.in(this.game_id).emit(
            "updatePlayerTurns",
            {
                player: player.player_name,
                used_actions: this.game.player_used_actions,
                total_actions: player.actions_per_turn
            }
        )
    }

    _curable_colours() {
        var player = this.game.current_player;
        var colour_to_cities = {};
        for (const c of player.player_cards) {
            if (!c.is_city)
                continue;
            var city = this.game.cities[c.city_name]
            var col = city.native_disease_colour;
            if (Object.keys(colour_to_cities).includes(col)) {
                colour_to_cities[col].push(c.city_name)
            } else {
                colour_to_cities[col] = [c.city_name]
            }
        }
        for (const k of Object.keys(colour_to_cities))
            colour_to_cities[k].sort()

        for (const [d_colour, disease] of Object.entries(this.game.diseases)) {
            if (!Object.keys(colour_to_cities).includes(d_colour))
                continue;
            if (disease.cured || colour_to_cities[d_colour].length < player.n_cards_to_cure)
                delete colour_to_cities[d_colour]
        }

        return colour_to_cities;
    }

    player_drive_ferry(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " drives/ferries to " + destination_city_name }
        )
        this._move_pawn(destination_city_name);
        this._check_end_of_user_turn();
    }

    player_direct_flight(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " takes direct flight to " + destination_city_name }
        )

        player.discard_card(destination_city_name);
        this.game.player_deck.discard([destination_city_name]);

        this._move_pawn(destination_city_name);

        this._check_end_of_user_turn();
    }

    player_shuttle_flight(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " takes shuttle flight to " + destination_city_name }
        )

        this._move_pawn(destination_city_name);
        this._check_end_of_user_turn();
    }

    player_charter_flight(data) {
        var destination_city_name = data.destination_city_name;
        var origin_city_name = data.origin_city_name;
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " takes charter flight to " + destination_city_name }
        )

        player.discard_card(origin_city_name);
        this.game.player_deck.discard([origin_city_name]);

        this._move_pawn(destination_city_name);
        this._check_end_of_user_turn();
    }

    _move_pawn(destination){
        var player = this.game.current_player;
        var city = this.game.cities[destination]
        player.move_pawn(city);
        if (player.role_name == "Medic"){
            for (const [colour,d] of Object.entries(this.game.diseases)){
                if (d.cured && city.disease_cubes[colour]>0){
                    this._treat_disease_for_free(colour);
                }
            }
        }
    }

    _check_end_of_user_turn() {
        this.game.player_used_actions++;
        var player = this.game.current_player;

        this.check_disease_status();
        this.check_game_status();// TODO Test for game won/lost

        if (this.game.player_used_actions >= player.actions_per_turn) {
            this.game.round++;
            var n_epidemics_drawn = this.game.player_deck.drawPlayerCards(2, player);
            if (n_epidemics_drawn) {
                if (this.game.resolve_epidemics(n_epidemics_drawn)){    
                    return;
                }
                this.check_disease_status();
                this.check_game_status();

            }
            if (player.player_cards.length > player.max_hand_cards) {
                // current player's turn over but needs to discard player cards
                this.io.to(player.socket_id).emit(
                    "reducePlayerHand",
                    {
                        max_cards: player.max_hand_cards,
                        current_cards: utils.array_from_objects_list(player.player_cards, "card_name")
                    }
                );
            } else {
                // current player's turn over and no cards to discard so can go straight on to next player
                if(this.infect_cities()) // Will return true if game over
                    return;
                this.game.new_player_turn();
            }
        } else {
            // current player has another action
            this.assess_player_options();
        }
    }

    check_disease_status() {
        for (const d of Object.values(this.game.diseases)) {
            if (d.eradicated)
                continue;
            if (d.cured && d.cubes_on_board == 0) {
                d.eradicate();
            }
        }
    }

    check_game_status() {
        for (const d of Object.values(this.game.diseases)) {
            if (!d.cured)
                return
        }
        this.io.in(this.game_id).emit(
            "gameOver", { message: "All diseases have been cured, you win!" }
        )
        this.game.gameOver();
    }


    infect_cities() {
        return this.game.infect_cities();
    }

    reducePlayerCardHand(cards) {
        for (const c of cards) {
            this.game.current_player.discard_card(c);
        }
        this.game.player_deck.discard(cards);
        if(this.infect_cities())
            return;
        this.game.new_player_turn();
    }

    player_treatDisease(data) {
        this._treat_disease_for_free(data.colour);
        this._check_end_of_user_turn();
    }

    _treat_disease_for_free(colour){
        var player = this.game.current_player;
        var city_name = player.city_name;

        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " treats the " + colour + " disease in " + city_name }
        )
        var city = this.game.cities[city_name];
        
        var n_removes = player.role_name == "Medic" ? city.disease_cubes[colour] : 1
        for (var i=0; i<n_removes; i++){
            city.remove_cube(colour);
        }
        this.game.update_infection_count();
    }

    player_pass() {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " is too scared to do anything and passes" }
        )
        this.game.player_used_actions = player.actions_per_turn + 1;
        this._check_end_of_user_turn();
    }

    player_build_research_station() {
        var player = this.game.current_player;
        var city_name = player.city_name;
        this.game.add_research_station(city_name);
        player.discard_card(city_name);
        this.game.player_deck.discard([city_name]);

        this._check_end_of_user_turn();
    }

    player_cure(cards) {
        var player = this.game.current_player;
        var colour = this.game.cities[cards[0]].native_disease_colour;
        var disease = this.game.diseases[colour];
        this.io.in(this.game_id).emit(
            "logMessage",
            { message: player.player_name + " cured the " + colour + " disease" }
        )
        for (const c of cards)
            player.discard_card(c);
        this.game.player_deck.discard(cards);
        disease.cure();

        this._check_end_of_user_turn();
    }

    player_shareKnowledgeProposal(data){
        var player = this.game.current_player;
        this.io.to(player.socket_id).emit("disableActions");
        var other_player = this.game.players.filter(
            (p) => {return p.player_name == data.other_player}
        )[0]
        this.io.in(this.game_id).emit(
            "logMessage",
            {
                message: player.player_name + " wants to trade " + data.card + " with " + data.other_player
            }
        )
        this.io.to(other_player.socket_id).emit(
            "incoming_shareKnowledgeProposal", 
            {
                trade_data: data,
                trade_player: player.player_name
            }
        )
    }

    player_shareKnowledgeResponse(data){
        if (data.answer == "Yes"){
            this.io.in(this.game_id).emit(
                "logMessage",
                {message: data.trade_data.other_player + " accepted the trade"}
            )
            var other_player = this.game.players.filter(
                (p) => {return p.player_name == data.trade_data.other_player}
            )[0]

            var take_player = data.trade_data.direction == "Take" ? this.game.current_player : other_player;
            var give_player = data.trade_data.direction != "Take" ? this.game.current_player : other_player;

            var card_data = give_player.discard_card(data.trade_data.card);
            this.io.to(give_player.socket_id).emit("refreshPlayerHand")
            take_player.receive_card_from_other_player(card_data);
            this._check_end_of_user_turn();
        } else {
            this.io.in(this.game_id).emit(
                "logMessage",
                {message: data.trade_data.other_player + " refused the trade"}
            )
            this.assess_player_options();
        }
    }

}

module.exports = Pandemic