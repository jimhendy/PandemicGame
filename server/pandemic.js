const utils = require("./game/utils")
const Game = require('./game/game');
const { objects_attribute_contains_value, dict_from_objects, array_from_objects_list } = require("./game/utils");
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

        // Bind Events
        this.assess_player_options = this.assess_player_options.bind(this);
        this.update_current_player = this.update_current_player.bind(this);

        // assess events
        this._assess_drive_ferry = this._assess_drive_ferry.bind(this);
        this._assess_direct_flight = this._assess_direct_flight.bind(this);
        this._assess_charter_flight = this._assess_charter_flight.bind(this);
        this._assess_shuttle_flight = this._assess_shuttle_flight.bind(this);
        this._assess_treat_disease = this._assess_treat_disease.bind(this);
        this._assess_build_research_station = this._assess_build_research_station.bind(this);
        this._assess_share_knowledge = this._assess_share_knowledge.bind(this);
        this._assess_discover_a_cure = this._assess_discover_a_cure.bind(this);
        this._assess_dispatcher_actions = this._assess_dispatcher_actions.bind(this);
        this._assess_operations_expert_actions = this._assess_operations_expert_actions.bind(this);
        
        this._assess_all_event_cards = this._assess_all_event_cards.bind(this);

        this._assess_airlift_event_card = this._assess_airlift_event_card.bind(this);
        this._assess_government_grant_event_card = this._assess_government_grant_event_card.bind(this);
        this._assess_one_quiet_night_event_card = this._assess_one_quiet_night_event_card.bind(this);
        this._assess_forecast_event_card = this._assess_forecast_event_card.bind(this);
        this._assess_resilient_population_event_card = this._assess_resilient_population_event_card.bind(this);

        // player events
        this.player_pass = this.player_pass.bind(this);
        this.player_move = this.player_move.bind(this);
        this.player_move_proposal = this.player_move_proposal.bind(this);
        this.player_move_response = this.player_move_response.bind(this);
        this.player_share_knowledge_proposal = this.player_share_knowledge_proposal.bind(this);
        this.player_share_knowledge_response = this.player_share_knowledge_response.bind(this);
        this.player_cure = this.player_cure.bind(this);
        this.player_treat_disease = this.player_treat_disease.bind(this);
        this.player_build_research_station = this.player_build_research_station.bind(this);
        this.player_skip_next_infection_step = this.player_skip_next_infection_step.bind(this);
        this.player_resilient_population = this.player_resilient_population.bind(this);
        this.player_forecast = this.player_forecast.bind(this);

        this._curable_colours = this._curable_colours.bind(this);
        this._player_by_name = this._player_by_name.bind(this);
        this._treat_disease_for_free = this._treat_disease_for_free.bind(this);
        this._move_pawn = this._move_pawn.bind(this);

        this._check_end_of_user_turn = this._check_end_of_user_turn.bind(this);
        this._add_check_end_turn_to_queue = this._add_check_end_turn_to_queue.bind(this);
        this.reduce_player_hand_size = this.reduce_player_hand_size.bind(this);
        this.reduce_player_hand_size_response = this.reduce_player_hand_size_response.bind(this);
        this._discard_cards = this._discard_cards.bind(this);

    }

    add_user(data, socket) {
        this.users[data.socket_id] = data;
        console.info('Player "' + data.player_name + '" joining game');
        socket.emit("clientAction", { function: "showRoleChoiceScreen", args: this._role_choice_data() });
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
        this.io.in(this.game_id).emit("clientAction", { function: 'updateRoles', args: this._role_choice_data() });
    }

    player_waiting(socket_id) {
        this.users[socket_id].ready_to_play = true;
        for (const [key, value] of Object.entries(this.users)) {
            if (!value.ready_to_play)
                return
        }
        this.start_game();
    }

    action_complete() {
        this.game.queue.add_response();
    }

    // =============================================  Starting Game

    start_game() {
        this.game = new Game(this.io, this.game_id);
        for (const p of Object.values(this.users)) {
            this.game.add_player(p);
        }

        this.io.in(this.game_id).emit(
            "clientAction",
            { function: 'startGame', args: this._role_choice_data() }
        );
        this.game.initial_game_setup();
        this.game.new_player_turn();
        this.game.queue.add_task(
            this.assess_player_options,
            null,
            0,
            "Assessing player options"
        )
        this.game.queue.start();
    }

    async assess_player_options() {
        var player = this.game.current_player;
        var city_name = player.city_name;
        var city = this.game.cities[city_name];

        this.update_current_player();

        var actions = [];

        this._assess_drive_ferry(actions, player, city);
        this._assess_direct_flight(actions, player, city);
        this._assess_charter_flight(actions, player, city);
        this._assess_shuttle_flight(actions, player, city);

        this._assess_build_research_station(actions, player, city);
        this._assess_treat_disease(actions, player, city);
        this._assess_share_knowledge(actions, player, city);
        this._assess_discover_a_cure(actions, player, city);

        this._assess_all_event_cards(actions, player, false);
        
        this._assess_pass(actions, player, city);

        if (player.role_name == "Operations Expert")
            this._assess_operations_expert_actions(actions, player, city);
        else if (player.role_name == "Dispatcher")
            this._assess_dispatcher_actions(actions, player, city);


        // Consider event cards from other players
        var other_player_actions = {}
        for (const p of this.game.players){
            if (p == player)
                continue
            var p_actions = [];
            this._assess_all_event_cards(p_actions, p, false);
            if (p_actions.length){
                other_player_actions[p.socket_id] = p_actions;
            }
        }
        
        await this.game.queue.run_until_empty();

        // Queue should be empty after this is run
        this.game.queue.add_task(
            () => {
                this.io.to(player.socket_id).emit(
                    "clientAction", { function: "enableActions", args: actions, return: false }
                )
                for (const [sid, a] of Object.entries(other_player_actions)){
                    this.io.to(sid).emit(
                        "clientAction", { function: "enableActions", args: a, return: false }
                    )   
                }
            },
            null, 0, "Enabling player options", false, true
        )
        if (!this.game.queue.running){
            this.game.queue.start()
        }

    }

    update_current_player() {
        var player = this.game.current_player;
        this.game.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction",
                {
                    function: "updatePlayerTurns",
                    args: {
                        player: player.player_name,
                        used_actions: this.game.player_used_actions,
                        total_actions: player.actions_per_turn
                    },
                    return: true
                }
            ),
            null,
            "all",
            "Updating current player & n_actions used"
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

    // =============================================  Assess Event cards

    _assess_all_event_cards(actions, player, skip_check_next=false){
        this._assess_airlift_event_card(actions, player, skip_check_next)
        this._assess_government_grant_event_card(actions, player, skip_check_next)
        this._assess_one_quiet_night_event_card(actions, player, skip_check_next)
        this._assess_forecast_event_card(actions, player, skip_check_next)
        this._assess_resilient_population_event_card(actions, player, skip_check_next)
    }

    _assess_airlift_event_card(actions, player, skip_check_next=false){
        if (array_from_objects_list(player.player_cards, "card_name").includes("Airlift")){
            for (const p of this.game.players) {
                for (const [city_name, city] of Object.entries(this.game.cities)){
                    if (p.city_name == city_name) continue // Don't move to current location
                    actions.push(
                        {
                            action: "Airlift",
                            action__stop_autochoice: true,
                            destination: city_name,
                            destination__colour: city.native_disease_colour,
                            player_name_being_moved: p.player_name,
                            player_name_causing_move: player.player_name,
                            player_name: p.player_name,
                            player_name__title: "Pick a player to move",
                            response_function: p == player ? "player_move" : "player_move_proposal",
                            discard_card_name: "Airlift",
                            costs_an_action: false,
                            skip_check_next: skip_check_next
                        }
                    )
                }
            }
        }
    }

    _assess_government_grant_event_card(actions, player, skip_check_next=false){
        if (array_from_objects_list(player.player_cards, "card_name").includes("Government Grant")){
            for (const [city_name, city] of Object.entries(this.game.cities)){
                if (city.has_research_station) continue
                actions.push(
                    {
                        action: "Government Grant",
                        action__stop_autochoice: true,
                        destination: city_name,
                        destination__colour: city.native_disease_colour,
                        player_name: player.player_name,
                        response_function: "player_build_research_station",
                        discard_card_name: "Government Grant",
                        costs_an_action: false,
                        skip_check_next: skip_check_next
                    }
                )
            }
        }
    }

    _assess_one_quiet_night_event_card(actions, player, skip_check_next=false){
        if (array_from_objects_list(player.player_cards, "card_name").includes("One Quiet Night")){
            actions.push(
                {
                    action: "One Quiet Night",
                    action__stop_autochoice: true,
                    player_name: player.player_name,
                    response_function: "player_skip_next_infection_step",
                    discard_card_name: "One Quiet Night",
                    costs_an_action: false,
                    skip_check_next: skip_check_next
                }
            )
        }
    }

    _assess_forecast_event_card(actions, player, skip_check_next=false){
        if (array_from_objects_list(player.player_cards, "card_name").includes("Forecast")){
            var num_cards = Math.min(6, this.game.infection_deck.deck.length);
            for (var i = 0; i<num_cards; i++){
                var card_name = this.game.infection_deck.deck[
                    this.game.infection_deck.deck.length - 1 - i
                ]
                var city = this.game.cities[card_name];
                actions.push(
                    {
                        action: "Forecast",
                        action__stop_autochoice: true,
                        player_name: player.player_name,
                        response_function: "player_forecast",
                        discard_card_name: "Forecast",
                        costs_an_action: false,
                        skip_check_next: skip_check_next,
                        infection_deck_card_name: card_name,
                        infection_deck_card_name__title: "Drag into order (top drawn first)",
                        infection_deck_card_name__sortable: true,
                        infection_deck_card_name__n_choices: num_cards,
                        infection_deck_card_name__colour: city.native_disease_colour,
                        infection_deck_card_name__cancel_button: false // Can't peek at cards and then cancel
                    }
                )
            }   
        }
    }

    _assess_resilient_population_event_card(actions, player, skip_check_next=false){
        if (array_from_objects_list(player.player_cards, "card_name").includes("Resilient Population")){
            for (const card_name of this.game.infection_deck.discarded){
                actions.push(
                    {
                        action: "Resilient Population",
                        action__stop_autochoice: true,
                        player_name: player.player_name,
                        response_function: "player_resilient_population",
                        discard_card_name: "Resilient Population",
                        costs_an_action: false,
                        skip_check_next: skip_check_next,
                        infection_deck_card_name: card_name,
                        infection_deck_card_name__title: "Pick an Infection Card to remove"
                    }
                )
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
                        action: "Move pawn to city with another pawn",
                        destination: p2.city_name,
                        player_name: p1.player_name,
                        response_function: p1 == player ? "player_move" : response_function, // don't need permission from yourself
                        player_name_being_moved: p1.player_name,
                        player_name_causing_move: player.player_name,
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
        if (city.has_research_station && !player.used_special_action_this_turn) {
            for (const c of player.player_cards) {
                if (c.is_city) {
                    for (const [dest_name, dest] of Object.entries(this.game.cities)) {
                        actions.push(
                            {
                                action: "Research Station to any city",
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

        // Hide everyone's selection (may have event card choices)
        this.io.to(this.game_id).emit(
            "clientAction", {function: "_hide_selections"}
        )

        // Add the next task to the queue to keep task order but don't expect any responses as server side methods
        this.game.queue.add_task(
            this[data.response_function],
            data,
            0,
            "Player action - " + data.response_function
        )
        // Can't always do check_end_of_user_turn as some responses are not a whole turn (e.g. reduce player hand size)
        this.game.queue.start();
    }

    _add_check_end_turn_to_queue(costs_an_action=true){
        this.game.queue.add_task(
            this._check_end_of_user_turn,
            costs_an_action,
            0,
            "Checking end of user turn"
        )
        //this.game.queue.start();
    }

    // ==================

    player_pass(data) {
        var player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit("logMessage",
            { message: player.player_name + " is too scared to do anything and passes" }
        )
        this.game.player_used_actions = player.actions_per_turn + 1;
        this._add_check_end_turn_to_queue();
    }

    player_move(data) {

        var player = this._player_by_name(data.player_name)
        this.io.in(this.game_id).emit("logMessage",
            { message: this.game.current_player.player_name + " moves (" + data.action + ") to " + data.destination }
        )
        if (data.action == "Research Station to any city")
            player.used_special_action_this_turn = true;

        this._discard_cards(player, data)
        this._move_pawn(data.destination, player);
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(data.costs_an_action !== false);
    }

    player_treat_disease(data) {
        this._treat_disease_for_free(data.disease_colour.toLowerCase());
        this._add_check_end_turn_to_queue();
    }

    player_build_research_station(data) {
        var player = this._player_by_name(data.player_name)
        var city_name = data.destination;
        this.game.add_research_station(city_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(data.costs_an_action !== false);
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
        this.game.player_deck.discard(data.answers.discard_card_name, player);
        disease.cure();
        this._add_check_end_turn_to_queue();
    }


    player_skip_next_infection_step(data){
        this.game.skip_infection_step = true;
        var player = this._player_by_name(data.player_name)
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(data.costs_an_action !== false)
    }


    player_resilient_population(data){
        this.game.infection_deck.remove_discarded_card(data.infection_deck_card_name)
        var player = this._player_by_name(data.player_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(data.costs_an_action !== false)
    }

    player_forecast(data){
        this.game.infection_deck.reorder_deck(data.answers.infection_deck_card_name) // In requested order (first to be drawn is element 0)
        var player = this._player_by_name(data.player_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(data.costs_an_action !== false)
    }

    // ======================================================== Event Cards
    /*
    event_card_airflit(data, actions) {
        var player = this._player_by_name(data.player_name)
        for (const p of this.game.players) {
            for (const [dest_name, dest] of this.game.cities) {
                actions.push(
                    {
                        action: "Airlift",
                        player_name: p.player_name,
                        current_player_name: player.player_name,
                        destination: dest_name,
                        discard_card_name: data.discard_card_name,
                        destination__colour: dest.native_disease_colour,
                        response_function: p == player ? "player_move" : "player_move_proposal"
                    }
                )
            }
        }
    }
    */

    // ======================================== Utils


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
            city.remove_cube(colour)
        }
        this.game.update_infection_count();
    }

    // =============================================== End of turn utils

    async _check_end_of_user_turn(costs_an_action=true) {
        if (costs_an_action)
            this.game.player_used_actions++;
        var player = this.game.current_player;

        this.check_disease_status();
        this.check_game_status()

        var all_actions_used = this.game.player_used_actions >= player.actions_per_turn

        if (all_actions_used) {
            this.game.round++;

            this.game.player_deck.drawPlayerCards(2, player);
            await this.game.queue.run_until_empty(); // Ensure cards are dealt before maybe running reduceHandSize
        }

        while (player.too_many_cards()){
            this.reduce_player_hand_size(player);
            await this.game.queue.run_until_empty(); // Ensure cards are removed before continuing
        }
            
        // Next step
        if (all_actions_used) 
            this.end_player_turn();
        else
            this.assess_player_options();
    }

    async end_player_turn() {
        // current player's turn over, move on the next player
        this.game.infect_cities();
        await this.game.queue.run_until_empty();
        this.game.new_player_turn();
        this.assess_player_options();
        this.game.queue.start();
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

    // =====================================  Reduce player hand size

    reduce_player_hand_size(player) {
        var actions = [];
        var n_discard = player.player_cards.length - player.max_hand_cards;
        var heading = "Select " + n_discard + (n_discard == 1 ? " card" : " cards") + " to discard"
        var event_cards = player.player_cards.filter(
            (c) => { return c.is_event; }
        )

        for (const c of player.player_cards) {
            actions.push(
                {
                    player_name: player.player_name,
                    discard_card_name: c.card_name,
                    discard_card_name__title: heading,
                    discard_card_name__n_choices: n_discard,
                    discard_card_name__checkboxes: true,
                    discard_card_name__cancel_button: event_cards.length,
                    action: "Discard",
                    action__title: "Max hand size exceeded",
                    response_function: "reduce_player_hand_size_response"

                }
            )
        }

        this._assess_all_event_cards(actions, player, true);

        this.game.queue.add_task(
            () => this.io.to(player.socket_id).emit(
                "clientAction", { function: "enableActions", args: actions }
            ),
            null,
            1,
            "Reducing player card hand size for " + player.player_name,
        )
    }

    reduce_player_hand_size_response(data) {
        var player = this._player_by_name(data.player_name)
        this._discard_cards(player, data)
        // Don't have to simulate action here as _discard_cards will take over
    }

    _discard_cards(player, data) {
        var discards = [];
        if (Object.keys(data.answers).includes("discard_card_name")) {
            discards = data.answers.discard_card_name;
        } else if (Object.keys(data).includes("discard_card_name")) {
            discards = data.discard_card_name;
        }
        if (!Array.isArray(discards))
            discards = [discards];
        this.game.player_deck.discard(discards, player)
    }

    // ===================================================== Proposals & Responses

    player_move_proposal(data) {
        var moving_player = this._player_by_name(data.player_name_being_moved)
        var causing_player = this._player_by_name(data.player_name_causing_move)

        this.io.in(this.game_id).emit(
            "logMessage",
            { message: causing_player.player_name + " wants to move " + moving_player.player_name + " to " + data.destination }
        )

        var question = "Allow " + causing_player.player_name + " to move you to " + data.destination + "?";
        var action = {
            action: "response",
            response_function: "player_move_response",
            response__title: question,
            response__cancel_button: false,
            move_proposal: data
        }

        this.io.to(moving_player.socket_id).emit(
            "clientAction",
            {
                function: "enableActions",
                args:
                    [
                        Object.assign({ ...action }, { response: "Yes" }),
                        Object.assign({ ...action }, { response: "No" })
                    ]
            }
        )
    }

    async player_move_response(data) {
        if (data.response == "Yes") {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.move_proposal.player_name_being_moved + " accepted the move" }
            )
            var moving_player = this._player_by_name(data.move_proposal.player_name_being_moved)
            var causing_player = this._player_by_name(data.move_proposal.player_name_causing_move)

            this._discard_cards(causing_player, data.move_proposal)
            this._move_pawn(data.move_proposal.destination, moving_player);
            await this.game.queue.run_until_empty();

            if (!data.move_proposal.skip_check_next)
            this._check_end_of_user_turn(data.move_proposal.costs_an_action !== false);
        } else {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.move_proposal.player_name_being_moved + " refused the move" }
            )
            this.assess_player_options();
        }
    }


    player_share_knowledge_proposal(data) {
        var other_player = this._player_by_name(data.player_name) // Not the current player
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
            "clientAction",
            {
                function: "enableActions",
                args:
                    [
                        Object.assign({ ...action }, { response: "Yes" }),
                        Object.assign({ ...action }, { response: "No" })
                    ]
            }
        )
    }

    async player_share_knowledge_response(data) {
        if (data.response == "Yes") {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.share_proposal.player_name + " accepted the trade" }
            )
            var player = this._player_by_name(data.share_proposal.current_player_name);
            var other_player = this._player_by_name(data.share_proposal.player_name);

            var take_player = data.share_proposal.share_direction == "Take" ? player : other_player;
            var give_player = data.share_proposal.share_direction != "Take" ? player : other_player;

            //var card_data = give_player.discard_card(data.share_proposal.discard_card_name);
            //this.io.to(give_player.socket_id).emit("clientAction", { function: "refreshPlayerHand" })
            this.game.player_deck.transfer_card_between_players(
                data.share_proposal.discard_card_name, take_player, give_player);
            await this.game.queue.run_until_empty();

            if (take_player.too_many_cards()){
                this.reduce_player_hand_size(take_player);
                await this.game.queue.run_until_empty(); // Ensure cards are removed before continuing
            }
            this._check_end_of_user_turn();
            this.game.queue.start();
        } else { // Trade refused
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.share_proposal.player_name + " refused the trade" }
            )
            this.assess_player_options();
        }
    }


}

module.exports = Pandemic