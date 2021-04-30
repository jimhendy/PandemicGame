const utils = require("./game/utils")
const Game = require('./game/game');
const { objects_attribute_contains_value, dict_from_objects } = require("./game/utils");
const disease = require("./game/disease");

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

        var actions = [];



        this._assess_drive_ferry(actions, player, city);
        this._assess_direct_flight(actions, player, city);
        this._assess_charter_flight(actions, player, city);
        this._assess_shuttle_flight(actions, player, city);

        this._assess_build_research_station(actions, player, city);
        this._assess_treat_disease(actions, player, city);
        this._assess_share_knowledge(actions, player, city);
        this._assess_discover_a_cure(actions, player, city);

        this._assess_pass(actions, player, city);

        if (player.role_name == "Operations Expert")
            this._assess_operations_expert_actions(actions, player, city);
        else if (player.role_name == "Dispatcher")
            this._assess_dispatcher_actions(actions, player, city);

        /*
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
            (has_current_city_card || player.role_name == "Operations Expert")
            &&
            this.game.n_research_stations < this.game.max_n_research_stations
            &&
            !city.has_research_station
        ) {
            actions.push("build_research_station");
        }
        if (city.has_research_station && this.game.n_research_stations > 1)
            actions.push("shuttle_flight")
        
        var special_action_data = null;
        if (player.role_name == "Operations Expert" && city.has_research_station && !player.used_special_action_this_turn){
            
            for (const card of player.player_cards){
                if (card.is_city){
                    if (!actions.includes("special_action")){
                        actions.push("special_action")
                        special_action_data = {};
                        special_action_data.cards = [];
                        special_action_data.destinations = [];
                        special_action_data.colours = [];
                        special_action_data.description = "Move from a research station to any city by discarding any City card"
                    }
                    special_action_data.cards.push(card.card_name);
                }
            }
            if (actions.includes("special_action")){
                for (const dest of Object.values(this.game.cities)){
                    special_action_data.destinations.push(dest.city_name);
                    special_action_data.colours.push(dest.native_disease_colour);
                }
            }        
        }

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

        var player_data = [];
        for (const p of this.game.players){
            player_data.push(
                {
                    player_name: p.player_name,
                    role_name: p.role_name,
                    city_name: p.city_name,
                    adjacent_city_names: this.game.cities[p.city_name].adjacent_city_names,
                    is_current_player: p == this.game.current_player
                }
            )
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
                role_name: player.role_name,
                adjacent_city_names: city.adjacent_city_names,
                research_station_city_names: this.game.research_station_city_names,
                curable_colours: colours_that_can_be_cured,
                n_cards_to_cure: player.n_cards_to_cure,
                current_city_cubes: city.disease_cubes,
                share_knowledge_data: share_knowledge_data,
                special_action_data: special_action_data,
                player_data: player_data
            })
        */
        this.io.to(player.socket_id).emit(
            "enableActions",
            actions,
        )
        this.io.in(this.game_id).emit(
            "updatePlayerTurns",
            {
                player: player.player_name,
                used_actions: this.game.player_used_actions,
                total_actions: player.actions_per_turn
            }
        )
    }

    // ====================================================== Assess player actions

    _assess_pass(actions, player, city) {
        actions.push(
            {
                player_name: player.player_name,
                action: "Pass",
                response_function: "player_pass"
            }
        )
    }

    _assess_drive_ferry(actions, player, city, response_function = "player_move") {
        for (const c of city.adjacent_city_names) {
            actions.push(
                {
                    player_name: player.player_name,
                    destination: c,
                    action: "Drive/Ferry",
                    response_function: response_function,
                    current_player_name: this.game.current_player.player_name
                }
            )
        }
    }

    _assess_direct_flight(actions, player, city, player_cards = null, response_function = "player_move") {
        player_cards = player_cards || player.player_cards;
        for (const c of player_cards) {
            if ((c.city_name == city.city_name) || !c.is_city) { continue; }
            actions.push(
                {
                    player_name: player.player_name,
                    destination: c.city_name,
                    action: "Direct Flight",
                    discard_card_name: c.card_name,
                    response_function: response_function,
                    current_player_name: this.game.current_player.player_name
                }
            )
        }
    }

    _assess_charter_flight(actions, player, city, player_cards = null, response_function = "player_move") {
        // Fly anywhere by discarding current city
        player_cards = player_cards || player.player_cards;
        for (const c of player_cards) {
            if (c.card_name == city.city_name) {
                for (const [dest_name, dest] of Object.entries(this.game.cities)) {
                    if (dest_name == city.city_name) continue
                    actions.push(
                        {
                            player_name: player.player_name,
                            destination: dest_name,
                            destination__colour: dest.native_disease_colour,
                            action: "Charter Flight",
                            discard_card_name: c.card_name,
                            response_function: response_function,
                            current_player_name: this.game.current_player.player_name
                        }
                    )
                }
            }
        }
    }

    _assess_shuttle_flight(actions, player, city, response_function = "player_move") {
        if (city.has_research_station) {
            for (const c of this.game.research_station_city_names) {
                if (c == city.city_name) continue;
                actions.push(
                    {
                        player_name: player.player_name,
                        action: "Shuttle Flight",
                        destination: c,
                        response_function: response_function,
                        current_player_name: this.game.current_player.player_name
                    }
                )
            }
        }
    }

    _assess_build_research_station(actions, player, city) {
        if (city.has_research_station) return;
        if (this.game.research_station_city_names.length >= this.game.max_n_research_stations) {
            // Technically the rules allow us to move a research station in this case ** TODO
            return;
        }
        if (player.role_name == "Operations Expert") {
            actions.push(
                {
                    action: "Build Research Station",
                    player_name: player.player_name,
                    response_function: "player_build_research_station",
                    destination: city.city_name
                }
            )
        } else {
            // Normal roles
            for (const c of player.player_cards) {
                if (c.card_name == city.city_name) {
                    actions.push(
                        {
                            action: "Build Research Station",
                            discard_card_name: c.card_name,
                            player_name: player.player_name,
                            response_function: "player_build_research_station",
                            destination: city.city_name
                        }
                    )
                }
            }
        }
    }

    _assess_treat_disease(actions, player, city) {
        for (const [colour, current_cubes] of Object.entries(city.disease_cubes)) {
            if (current_cubes > 0) {
                actions.push(
                    {
                        action: "Treat Disease",
                        disease_colour: utils.toTitleCase(colour),
                        player_name: player.player_name,
                        response_function: "player_treat_disease"
                    }
                )
            }
        }
    }

    _assess_share_knowledge(actions, player, city) {
        for (const other_player of this.game.players) {
            if (other_player == player) continue;
            if (other_player.city_name != city.city_name) continue;

            // Give this city
            for (const pc of player.player_cards) {
                if (!pc.is_city) continue;
                if (pc.card_name == city.city_name || player.role_name == "Researcher") {
                    actions.push(
                        {
                            action: "Share Knowledge",
                            player_name: other_player.player_name,
                            player_name__title: "Chose player to trade with",
                            current_player_name: player.player_name,
                            discard_card_name: pc.card_name,
                            share_direction: "Give",
                            share_direction__title: "Chose trade direction",
                            response_function: "player_share_knowledge_proposal"
                        }
                    )
                }
            }

            // Take this city
            for (const pc of other_player.player_cards) {
                if (!pc.is_city) continue;
                if (pc.card_name == city.city_name || other_player.role_name == "Researcher") {
                    actions.push(
                        {
                            action: "Share Knowledge",
                            player_name: other_player.player_name,
                            player_name__title: "Chose player to trade with",
                            current_player_name: player.player_name,
                            discard_card_name: pc.card_name,
                            share_direction: "Take",
                            share_direction__title: "Chose trade direction",
                            response_function: "player_share_knowledge_proposal"
                        }
                    )
                }
            }
        }
    }

    _assess_discover_a_cure(actions, player, city) {
        var colours_that_can_be_cured = null;
        if (city.has_research_station) {
            colours_that_can_be_cured = this._curable_colours(player);
            for (const [colour, cards] of Object.entries(colours_that_can_be_cured)) {
                for (const c of cards) {
                    actions.push(
                        {
                            player_name: player.player_name,
                            action: "Discover A Cure",
                            disease_colour: colour,
                            discard_card_name: c,
                            discard_card_name__n_choices: player.n_cards_to_cure,
                            discard_card_name__checkboxes: true,
                            response_function: "player_cure"
                        }
                    )
                }
            }
        }
    }

    // =========================================================== Assess role specific player actions

    _assess_dispatcher_actions(actions, player, city) {
        var response_function = "player_move_proposal";

        // Move any pawn to any city containing another pawn
        for (const p1 of this.game.players) {
            for (const p2 of this.game.players) {
                if (p1 == p2) continue;
                if (p1.city_name == p2.city_name) continue
                actions.push(
                    {
                        action: "Special - Move pawn to city with another pawn",
                        destination: p2.city_name,
                        player_name: p1.player_name,
                        response_function: p1 == player ? "player_move" : response_function, // don't need permission from yourself
                        current_player_name: player.player_name
                    }
                )
            }
        }

        // Move another pawn as if it were your own
        var player_cards = player.player_cards;
        for (const p of this.game.players) {
            if (p == player) continue;
            var player_city = this.game.cities[p.city_name];
            this._assess_drive_ferry(actions, p, player_city, response_function)
            this._assess_direct_flight(actions, p, player_city, player_cards, response_function)
            this._assess_charter_flight(actions, p, player_city, player_cards, response_function)
            this._assess_shuttle_flight(actions, p, player_city, response_function)
        }
    }

    _assess_operations_expert_actions(actions, player, city) {
        if (city.has_research_station) {
            for (const c of player.player_cards) {
                if (c.is_city) {
                    for (const [dest_name, dest] of Object.entries(this.game.cities)) {
                        actions.push(
                            {
                                action: "Special - Research Station to any city",
                                player_name: player.player_name,
                                destination: dest_name,
                                destination__colour: dest.native_disease_colour,
                                destination__title: "Chose destination",
                                discard_card_name: c.card_name,
                                discard_card_name__title: "Discard which City card?",
                                response_function: "player_move"
                            }
                        )
                    }
                }
            }
        }
    }

    // ==================

    action_response(data) {
        this[data.response_function](data);
    }

    // ==================

    player_pass(data) {
        var player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " is too scared to do anything and passes" }
        )
        this.game.player_used_actions = player.actions_per_turn + 1;
        this._check_end_of_user_turn();
    }

    player_move(data) {
        var player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit("logMessage",
            { message: this.game.current_player.player_name + " moves (" + data.action + ") to " + data.destination }
        )
        this._discard_cards(player, data)
        this._move_pawn(data.destination, player);
        this._check_end_of_user_turn();
    }

    player_treat_disease(data) {
        this._treat_disease_for_free(data.disease_colour.toLowerCase());
        this._check_end_of_user_turn();
    }

    player_build_research_station(data) {
        var player = this._player_by_name(data.player_name)
        var city_name = data.destination;
        this.game.add_research_station(city_name);
        this._discard_cards(player, data)
        this._check_end_of_user_turn();
    }

    player_cure(data) {
        var player = this._player_by_name(data.player_name);
        var colour = data.disease_colour;
        var disease = this.game.diseases[colour];
        this.io.in(this.game_id).emit(
            "logMessage",
            { message: player.player_name + " cured the " + colour + " disease" }
        )
        for (const c of data.answers.discard_card_name)
            player.discard_card(c);
        this.game.player_deck.discard(data.answers.discard_card_name);
        disease.cure();

        this._check_end_of_user_turn();
    }

    // =======================


    _curable_colours(player) {

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
        for (const [d_colour, disease] of Object.entries(this.game.diseases)) {
            if (!Object.keys(colour_to_cities).includes(d_colour))
                continue;
            if (disease.cured || colour_to_cities[d_colour].length < player.n_cards_to_cure)
                delete colour_to_cities[d_colour]
        }
        for (const k of Object.keys(colour_to_cities))
            colour_to_cities[k].sort()

        return colour_to_cities;
    }

    /*

    player_drive_ferry(destination_city_name) {
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " drives/ferries to " + destination_city_name }
        )
        this._move_pawn(destination_city_name);
        this._check_end_of_user_turn();
    }

    dispatcher_move_request(data){
        this.io.to(this.game.current_player.socket_id).emit("disableActions");
        var player = null;
        for (const p of this.game.players)
            if (p.player_name == data.player_name)
                player = p
        this.io.in(this.game_id).emit(
            "logMessage", 
            {
                message: this.game.current_player.player_name + " wants to move " + player.player_name + " to " + data.destination
            }
        )
        this.io.to(player.socket_id).emit("dispatcher_move_request", data);
    }

    dispatcher_move_response(data){
        if (data.response == "Yes"){
            var player = null;
            for (const p of this.game.players)
                if (p.player_name == data.data.player_name)
                    player = p
            this.io.in(this.game_id).emit("logMessage",
                { message: this.game.current_player.player_name + " move " + player.player_name + " to " + data.data.destination }
            )
            if (Object.keys(data.data).includes("discard_card_name")){
                this.game.current_player.discard_card(data.data.discard_card_name);
                this.game.player_deck.discard([data.data.discard_card_name]);
            }
            this._move_pawn(data.data.destination, player);
            this._check_end_of_user_turn();
        } else {
            this.io.to(this.game_id).emit("logMessage", {message: "Dispatcher move denied"})
            this.assess_player_options();
        }
    }
    */

    _player_by_name(player_name) {
        for (const p of this.game.players)
            if (p.player_name == player_name)
                return p
    }

    _move_pawn(destination, player = null) {
        var player = player == null ? this.game.current_player : player;
        var city = this.game.cities[destination]
        player.move_pawn(city);
        if (player.role_name == "Medic") {
            for (const [colour, d] of Object.entries(this.game.diseases)) {
                if (d.cured && city.disease_cubes[colour] > 0) {
                    this._treat_disease_for_free(colour);
                }
            }
        }
    }

    _check_end_of_user_turn() {
        this.game.player_used_actions++;
        var player = this.game.current_player;

        this.check_disease_status();
        if (this.check_game_status()) return;

        if (this.game.player_used_actions >= player.actions_per_turn) {
            this.game.round++;
            var n_epidemics_drawn = this.game.player_deck.drawPlayerCards(2, player);
            if (n_epidemics_drawn) {
                if (this.game.resolve_epidemics(n_epidemics_drawn)) {
                    return;
                }
                this.check_disease_status();
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
                if (this.infect_cities()) // Will return true if game over
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
        if (this.infect_cities())
            return;
        this.game.new_player_turn();
    }



    _treat_disease_for_free(colour) {
        var player = this.game.current_player;
        var city_name = player.city_name;

        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " treats the " + colour + " disease in " + city_name }
        )
        var city = this.game.cities[city_name];
        var disease = this.game.diseases[colour];

        var n_removes = (player.role_name == "Medic" || disease.cured) ? city.disease_cubes[colour] : 1
        for (var i = 0; i < n_removes; i++) {
            city.remove_cube(colour);
        }
        this.game.update_infection_count();
    }

    _discard_cards(player, data) {
        if (Object.keys(data).includes("discard_card_name")) {
            var card_names = data.discard_card_name;
            if (!Array.isArray(card_names))
                card_names = [card_names];
            this.game.player_deck.discard(card_names)
            for (const c of card_names) {
                player.discard_card(c)
            }
        }
    }

    // ===================================================== Proposals & Responses

    player_move_proposal(data) {
        var other_player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit(
            "logMessage",
            { message: data.current_player_name + " wants to move " + other_player.player_name + " to " + data.destination }
        )

        var question = "Allow " + data.current_player_name + " to move you to " + data.destination + "?";
        var action = {
            action: "response",
            response_function: "player_move_response",
            response__title: question,
            response__cancel_button: false,
            move_proposal: data
        }

        this.io.to(other_player.socket_id).emit(
            "enableActions",
            [
                Object.assign({ ...action }, { response: "Yes" }),
                Object.assign({ ...action }, { response: "No" })
            ]
        )
    }

    player_move_response(data) {
        if (data.response == "Yes") {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.move_proposal.player_name + " accepted the move" }
            )
            var current_player = this._player_by_name(data.move_proposal.current_player_name);
            var move_player = this._player_by_name(data.move_proposal.player_name);

            this._discard_cards(current_player, data.move_proposal)
            this._move_pawn(data.move_proposal.destination, move_player);
            this._check_end_of_user_turn();
        } else {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.move_proposal.player_name + " refused the move" }
            )
            this.assess_player_options();
        }
    }


    player_share_knowledge_proposal(data) {
        var other_player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit(
            "logMessage",
            { message: data.current_player_name + " wants to trade " + data.discard_card_name + " with " + data.player_name }
        )
        var direction = data.share_direction == "Give" ? "Receive " : "Give ";
        var from_to = data.share_direction == "Give" ? " from " : " to "
        var question = direction + " " + data.discard_card_name + from_to + data.current_player_name + "?";

        var action = {
            action: "response",
            response_function: "player_share_knowledge_response",
            response__title: question,
            response__cancel_button: false,
            share_proposal: data
        }

        this.io.to(other_player.socket_id).emit(
            "enableActions",
            [
                Object.assign({ ...action }, { response: "Yes" }),
                Object.assign({ ...action }, { response: "No" })
            ]
        )
    }

    player_share_knowledge_response(data) {
        if (data.response == "Yes") {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.share_proposal.player_name + " accepted the trade" }
            )
            var player = this._player_by_name(data.share_proposal.current_player_name);
            var other_player = this._player_by_name(data.share_proposal.player_name);

            var take_player = data.share_proposal.share_direction == "Take" ? player : other_player;
            var give_player = data.share_proposal.share_direction != "Take" ? player : other_player;

            var card_data = give_player.discard_card(data.share_proposal.discard_card_name);
            this.io.to(give_player.socket_id).emit("refreshPlayerHand")
            take_player.receive_card_from_other_player(card_data);
            this._check_end_of_user_turn();
        } else {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.share_proposal.player_name + " refused the trade" }
            )
            this.assess_player_options();
        }
    }
    /*
    player_fly_using_card(data) {
        var destination_city_name = data.destination;
        var discard_card_name = data.card_name;
        this.game.current_player.used_special_action_this_turn = true;
        var player = this.game.current_player;
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " takes a special flight to " + destination_city_name }
        )

        player.discard_card(discard_card_name);
        this.game.player_deck.discard([discard_card_name]);

        this._move_pawn(destination_city_name);
        this._check_end_of_user_turn();
    }
    */

}

module.exports = Pandemic