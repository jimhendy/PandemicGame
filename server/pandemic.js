const utils = require("./game/utils")
const Game = require('./game/game');
const GameIO = require("./game/game_io");
const { city_definitions } = require("./game/city");

const ALL_ROLES = [
    "Contingency Planner",
    "Dispatcher",
    "Medic",
    "Operations Expert",
    "Quarantine Specialist",
    "Researcher",
    "Scientist"
];
const MAX_PLAYERS = 4;
const LOG_LIMIT = 500;

class Pandemic {
    constructor(io, game_id, title, host_pid, on_change) {
        this.game_id = game_id;
        this.title = title;
        this.host = host_pid;
        this.on_change = on_change; // tells the lobby its list of games is out of date
        this.io = new GameIO(io, game_id, this._on_broadcast.bind(this));
        this.all_roles = ALL_ROLES;
        this.members = new Map(); // pid -> {name, role, ready, sockets}, in joining order
        this.phase = "lobby"; // then "playing", then "over"
        this.game = null;
        this.n_epidemics = 5;
        this.pending = new Map(); // pid -> actions they've been offered and not yet answered
        this.log = []; // log messages so far, for players who reconnect
        this.game_over = null;
        this.updated = Date.now();

        // Bind Events
        this.assess_player_options = this.assess_player_options.bind(this);
        this.update_current_player = this.update_current_player.bind(this);

        this.allow_players_to_use_event_cards = this.allow_players_to_use_event_cards.bind(this)

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
        this._assess_contingency_planner_actions = this._assess_contingency_planner_actions.bind(this);

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
        this.player_response_cancel = this.player_response_cancel.bind(this);
        this.player_pick_up_discarded_event_card = this.player_pick_up_discarded_event_card.bind(this);

        this._curable_colours = this._curable_colours.bind(this);
        this._player_by_name = this._player_by_name.bind(this);
        this._treat_disease_for_free = this._treat_disease_for_free.bind(this);
        this._move_pawn = this._move_pawn.bind(this);

        this._check_end_of_user_turn = this._check_end_of_user_turn.bind(this);
        this._add_check_end_turn_to_queue = this._add_check_end_turn_to_queue.bind(this);
        this.reduce_player_hand_size = this.reduce_player_hand_size.bind(this);
        this.reduce_player_hand_size_response = this.reduce_player_hand_size_response.bind(this);
        this._discard_cards = this._discard_cards.bind(this);
        this._perform_move = this._perform_move.bind(this);
        this.on_settle = this.on_settle.bind(this);
    }

    // =============================================  Before the game: joining, roles, ready

    join(pid, name) {
        if (this.members.has(pid)) return;
        if (this.phase != "lobby") throw new Error("That game has already started.");
        if (this.members.size >= MAX_PLAYERS) throw new Error("That game is full.");
        this.members.set(pid, { name: this._unique_name(pid, name), role: null, ready: false, sockets: new Set() });
        this._lobby_changed();
    }

    leave(pid) {
        if (this.phase != "lobby" || !this.members.has(pid)) return;
        this.members.delete(pid);
        if (this.host == pid) this.host = this.members.keys().next().value || null;
        this._lobby_changed();
    }

    rename(pid, name) {
        var member = this.members.get(pid);
        if (!member || this.phase != "lobby") return;
        member.name = this._unique_name(pid, name);
        this._lobby_changed();
    }

    _unique_name(pid, name) {
        var taken = [...this.members].filter(([p]) => p != pid).map(([p, m]) => m.name);
        var unique = name;
        for (var n = 2; taken.includes(unique); n++) unique = name + " " + n;
        return unique;
    }

    set_role(pid, role) {
        var member = this.members.get(pid);
        if (!member || this.phase != "lobby" || !this.all_roles.includes(role)) return;
        for (const [p, m] of this.members)
            if (p != pid && m.role == role) return; // someone else has it
        member.role = role;
        member.ready = false;
        this._lobby_changed();
    }

    set_epidemics(pid, number) {
        number = parseInt(number);
        if (!this.members.has(pid) || this.phase != "lobby" || ![4, 5, 6].includes(number)) return;
        this.n_epidemics = number;
        this._lobby_changed();
    }

    set_ready(pid, ready) {
        var member = this.members.get(pid);
        if (!member || this.phase != "lobby" || (ready && !member.role)) return;
        member.ready = !!ready;
        this._lobby_changed();
    }

    // Everyone has a role, and everyone but the host has said they're ready
    can_start() {
        return [...this.members].every(([pid, m]) => m.role && (m.ready || pid == this.host));
    }

    start(pid) {
        if (this.phase != "lobby") return;
        if (pid != this.host) throw new Error("Only the host can start the game.");
        if (!this.can_start()) throw new Error("Everyone needs to pick a role and be ready first.");
        this.start_game();
    }

    lobby_state(pid) {
        return {
            game_id: this.game_id,
            title: this.title,
            epidemics: this.n_epidemics,
            all_roles: this.all_roles,
            max_players: MAX_PLAYERS,
            can_start: this.can_start(),
            members: [...this.members].map(([p, m]) => ({
                name: m.name, role: m.role, ready: m.ready, online: m.sockets.size > 0, host: p == this.host, you: p == pid
            }))
        }
    }

    _lobby_changed() {
        this.updated = Date.now();
        if (this.phase == "lobby")
            for (const pid of this.members.keys())
                this.io.to(this._room(pid)).emit("game_lobby", this.lobby_state(pid));
        this.on_change();
    }

    _room(pid) { return this.game_id + ":" + pid; }

    // =============================================  Connections

    attach(socket, pid) {
        socket.join(this.game_id);
        var member = this.members.get(pid);
        if (member) {
            socket.join(this._room(pid));
            member.sockets.add(socket.id);
        }
        if (this.phase == "lobby") {
            this._lobby_changed();
        } else {
            this.sync(socket, pid);
            this._presence_changed();
        }
    }

    detach(socket, pid) {
        var member = this.members.get(pid);
        if (!member || !member.sockets.delete(socket.id) || member.sockets.size) return;
        if (this.phase == "lobby") {
            this._lobby_changed();
        } else {
            if (this.game) this.game.queue.drop(pid); // don't wait for them
            // If they were being offered the chance to play an event card, they'd rather not
            var decline = (this.pending.get(pid) || []).find((a) => a.response_function == "player_response_cancel");
            if (decline) this.handle_response(pid, { ...decline, answers: {} });
            this._presence_changed();
        }
    }

    connected_player_pids() {
        return [...this.members].filter(([pid, m]) => m.sockets.size > 0).map(([pid]) => pid);
    }

    _presence_changed() {
        if (this.game) this.io.to(this.game_id).emit("players", this.players_info());
        this.on_change();
    }

    // The queue has caught up (or is waiting for someone), so the players panel is accurate
    on_settle() {
        this.io.to(this.game_id).emit("players", this.players_info());
    }

    // Everything a player needs to draw the game from scratch, e.g. after a refresh
    sync(socket, pid) {
        var player = this._player_by_pid(pid);
        socket.emit("sync", {
            game_id: this.game_id,
            title: this.title,
            cities: city_definitions,
            me: player ? { name: player.player_name, role: player.role_name, city: player.city_name } : null,
            hand: player ? player.player_cards : [],
            images: this.game.board_images(),
            infection_count: this.game.infection_count(),
            cards_remaining: this.game.player_deck.remaining_message(),
            players: this.players_info(),
            log: this.log,
            game_over: this.game_over
        });
        if (player && this.pending.has(pid))
            socket.emit("clientAction", { function: "enableActions", args: this.pending.get(pid) });
    }

    players_info() {
        var current = this.game.current_player;
        return {
            players: this.game.players.map((p) => ({
                name: p.player_name,
                role: p.role_name,
                city: p.city_name,
                online: (this.members.get(p.pid)?.sockets.size || 0) > 0,
                current: p == current,
                cards: p.player_cards.map((c) => ({
                    name: c.card_name,
                    colour: c.is_city ? this.game.cities[c.city_name].native_disease_colour : null
                })),
                extra_card: p.contingency_planner_event_card_name
            })),
            turn: current ? { player: current.player_name, used: this.game.player_used_actions, total: current.actions_per_turn } : null
        };
    }

    _on_broadcast(event, data, logs) {
        this.log.push(...logs);
        if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
        if (event == "clientAction" && (data.function == "gameWin" || data.function == "gameLose")) {
            this.phase = "over";
            this.game_over = { win: data.function == "gameWin", message: data.args.message };
            this.pending.clear();
            this.updated = Date.now();
            this.on_change();
        }
    }

    // A player answered one of the choices they were offered
    handle_response(pid, data) {
        if (this.phase != "playing" || !data) return;
        var offered = this.pending.get(pid) || [];
        if (!offered.some((a) => a.response_function == data.response_function)) {
            console.warn("Ignoring an answer to a question nobody asked: " + data.response_function);
            return;
        }
        this.pending.clear(); // answering hides everyone's choices
        this.updated = Date.now();
        this.action_response(data);
    }

    // A player's client finished an animation
    handle_complete(pid) {
        if (this.game) this.game.queue.add_response(pid);
    }

    _prompt(player, actions) {
        this.pending.set(player.pid, actions);
        this.io.to(player.room).emit("clientAction", { function: "enableActions", args: actions });
    }

    _show_gif(kind) {
        this.game.queue.add_task(
            () => this.io.in(this.game_id).emit("clientAction", { function: "showGif", args: kind, return: true }),
            null, "all", "Showing " + kind + " gif"
        )
    }

    // =============================================  The games list

    summary(pid) {
        var status;
        if (this.phase == "lobby")
            status = "Waiting for players · " + this.members.size + "/" + MAX_PLAYERS;
        else if (this.phase == "over")
            status = this.game_over && this.game_over.win ? "Won!" : "Lost";
        else
            status = "In progress · turn " + (this.game.round + 1);
        return {
            id: this.game_id,
            title: this.title,
            phase: this.phase,
            status: status,
            mine: this.members.has(pid),
            players: [...this.members.values()].map((m) => ({ name: m.name, role: m.role, online: m.sockets.size > 0 })),
            can_delete: this.can_delete(pid),
            updated: this.updated
        };
    }

    // The host can always delete; anyone in it once it's over or nobody's playing it
    can_delete(pid) {
        if (pid == this.host) return true;
        return this.members.has(pid) && (this.phase == "over" || this.connected_player_pids().length == 0);
    }

    destroy(message) {
        if (this.game) this.game.queue.game_over = true;
        this.phase = "over";
        this.pending.clear();
        this.io.to(this.game_id).emit("gone", { message: message });
    }

    // =============================================  Starting Game

    async start_game() {
        this.phase = "playing";
        this.updated = Date.now();
        this.game = new Game(this);
        for (const [pid, m] of this.members)
            this.game.add_player({ player_name: m.name, role: m.role, pid: pid });

        this.io.in(this.game_id).emit(
            "clientAction",
            { function: 'startGame', args: { game_id: this.game_id, title: this.title, cities: city_definitions } }
        );
        this.on_change();
        this._show_gif("start");
        this.game.initial_game_setup();
        await this.game.queue.run_until_empty();

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
        if (this.game.queue.game_over)
            return;
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
        else if (player.role_name == "Contingency Planner")
            this._assess_contingency_planner_actions(actions, player, city);


        // Consider event cards from other players
        var other_player_actions = [];
        for (const p of this.game.players) {
            if (p == player)
                continue
            var p_actions = [];
            this._assess_all_event_cards(p_actions, p, false);
            if (p_actions.length) {
                other_player_actions.push([p, p_actions]);
            }
        }

        await this.game.queue.run_until_empty();

        // Queue should be empty after this is run
        this.game.queue.add_task(
            () => {
                this._prompt(player, actions);
                for (const [p, a] of other_player_actions)
                    this._prompt(p, a);
            },
            null, 0, "Enabling player options", false, true
        )
        if (!this.game.queue.running) {
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

    _remaining_actions() {
        return Math.max(1, this.game.current_player.actions_per_turn - this.game.player_used_actions);
    }

    // Every city within the actions left this turn, by the shortest route (one action per step)
    _drive_paths(start, max_steps) {
        var paths = {};
        var frontier = [[start, []]];
        var seen = new Set([start]);
        while (frontier.length) {
            var [name, path] = frontier.shift();
            if (path.length >= max_steps) continue;
            for (const next of this.game.cities[name].adjacent_city_names) {
                if (seen.has(next)) continue;
                seen.add(next);
                paths[next] = path.concat([next]);
                frontier.push([next, paths[next]]);
            }
        }
        return paths;
    }

    _is_drive_path(start, path, max_steps) {
        if (!Array.isArray(path) || !path.length || path.length > max_steps) return false;
        var previous = start;
        for (const name of path) {
            var city = this.game.cities[previous];
            if (!city || !city.adjacent_city_names.includes(name)) return false;
            previous = name;
        }
        return true;
    }

    _assess_drive_ferry(actions, player, city, response_function = "player_move") {
        var paths = Object.entries(this._drive_paths(city.city_name, this._remaining_actions()));
        paths.sort((a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]));
        for (const [c, path] of paths) {
            actions.push(
                {
                    player_name: player.player_name,
                    destination: c,
                    destination__colour: this.game.cities[c].native_disease_colour,
                    destination__label: c + (path.length > 1 ? " (" + path.length + " actions)" : ""),
                    path: path,
                    actions_cost: path.length,
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
        var remove_stations = [null];
        if (this.game.research_station_city_names.length >= this.game.max_n_research_stations) {
            remove_stations = this.game.research_station_city_names;
        }
        for (const remove_city_name of remove_stations){
            if (player.role_name == "Operations Expert") {
                actions.push(
                    {
                        action: "Build Research Station",
                        player_name: player.player_name,
                        response_function: "player_build_research_station",
                        destination: city.city_name,
                        remove_research_station_city_name: remove_city_name,
                        remove_research_station_city_name__title: "Select a research station to remove"
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
                                destination: city.city_name,
                                remove_research_station_city_name: remove_city_name,
                                remove_research_station_city_name__title: "Select a research station to remove"
                            }
                        )
                    }
                }
            }
        }
    }

    _assess_treat_disease(actions, player, city) {
        for (const [colour, current_cubes] of Object.entries(city.disease_cubes)) {
            if (current_cubes > 0) {
                // The Medic, or a cured disease, clears every cube in one action
                var clears_all = player.role_name == "Medic" || this.game.diseases[colour].cured;
                var most = clears_all ? 1 : Math.min(current_cubes, this._remaining_actions());
                for (var n = 1; n <= most; n++) {
                    actions.push(
                        {
                            action: "Treat Disease",
                            disease_colour: utils.toTitleCase(colour),
                            treat_count: n,
                            treat_count__title: "How many cubes?",
                            treat_count__label: clears_all ? "All of them (1 action)" : n + (n == 1 ? " cube (1 action)" : " cubes (" + n + " actions)"),
                            actions_cost: n,
                            player_name: player.player_name,
                            response_function: "player_treat_disease"
                        }
                    )
                }
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
                            discard_card_name__title: "Pick a card to give",
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
                            discard_card_name__title: "Pick a card to take",
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
                            destination: city.city_name,
                            disease_colour: utils.toTitleCase(colour),
                            discard_card_name: c,
                            discard_card_name__n_choices: player.n_cards_to_cure,
                            discard_card_name__checkboxes: true,
                            discard_card_name__title: "Discard " + player.n_cards_to_cure + " cards to cure",
                            response_function: "player_cure"
                        }
                    )
                }
            }
        }
    }

    // =============================================  Assess Event cards

    _assess_all_event_cards(actions, player, skip_check_next = false) {
        this._assess_airlift_event_card(actions, player, skip_check_next)
        this._assess_government_grant_event_card(actions, player, skip_check_next)
        this._assess_one_quiet_night_event_card(actions, player, skip_check_next)
        this._assess_forecast_event_card(actions, player, skip_check_next)
        this._assess_resilient_population_event_card(actions, player, skip_check_next)
    }

    _assess_airlift_event_card(actions, player, skip_check_next = false) {
        var event_card_name = "Airlift"
        if (player.has_event_card(event_card_name)) {
            for (const p of this.game.players) {
                for (const [city_name, city] of Object.entries(this.game.cities)) {
                    if (p.city_name == city_name) continue // Don't move to current location
                    actions.push(
                        {
                            action: event_card_name,
                            action__stop_autochoice: true,
                            destination: city_name,
                            destination__colour: city.native_disease_colour,
                            player_name_being_moved: p.player_name,
                            player_name_causing_move: player.player_name,
                            player_name: p.player_name,
                            player_name__title: "Pick a player to move",
                            response_function: p == player ? "player_move" : "player_move_proposal",
                            discard_card_name: event_card_name,
                            costs_an_action: false,
                            skip_check_next: skip_check_next,
                            is_contingency_planner_extra_card: player.is_contingency_planner_extra_card(event_card_name)
                        }
                    )
                }
            }
        }
    }

    _assess_government_grant_event_card(actions, player, skip_check_next = false) {
        var event_card_name = "Government Grant";
        if (player.has_event_card(event_card_name)) {
            for (const [city_name, city] of Object.entries(this.game.cities)) {
                if (city.has_research_station) continue
                actions.push(
                    {
                        action: event_card_name,
                        action__stop_autochoice: true,
                        destination: city_name,
                        destination__colour: city.native_disease_colour,
                        player_name: player.player_name,
                        response_function: "player_build_research_station",
                        discard_card_name: event_card_name,
                        costs_an_action: false,
                        skip_check_next: skip_check_next,
                        is_contingency_planner_extra_card: player.is_contingency_planner_extra_card(event_card_name)
                    }
                )
            }
        }
    }

    _assess_one_quiet_night_event_card(actions, player, skip_check_next = false) {
        var event_card_name = "One Quiet Night"
        if (player.has_event_card(event_card_name)) {
            actions.push(
                {
                    action: event_card_name,
                    action__stop_autochoice: true,
                    player_name: player.player_name,
                    response_function: "player_skip_next_infection_step",
                    discard_card_name: event_card_name,
                    costs_an_action: false,
                    skip_check_next: skip_check_next,
                    is_contingency_planner_extra_card: player.is_contingency_planner_extra_card(event_card_name)
                }
            )
        }
    }

    _assess_forecast_event_card(actions, player, skip_check_next = false) {
        var event_card_name = "Forecast"
        if (player.has_event_card(event_card_name)) {
            var num_cards = Math.min(6, this.game.infection_deck.deck.length);
            for (var i = 0; i < num_cards; i++) {
                var card_name = this.game.infection_deck.deck[
                    this.game.infection_deck.deck.length - 1 - i
                ]
                var city = this.game.cities[card_name];
                actions.push(
                    {
                        action: event_card_name,
                        action__stop_autochoice: true,
                        player_name: player.player_name,
                        response_function: "player_forecast",
                        discard_card_name: event_card_name,
                        costs_an_action: false,
                        skip_check_next: skip_check_next,
                        infection_deck_card_name: card_name,
                        infection_deck_card_name__title: "Drag into order (top drawn first)",
                        infection_deck_card_name__sortable: true,
                        infection_deck_card_name__n_choices: num_cards,
                        infection_deck_card_name__colour: city.native_disease_colour,
                        infection_deck_card_name__cancel_button: false, // Can't peek at cards and then cancel
                        is_contingency_planner_extra_card: player.is_contingency_planner_extra_card(event_card_name)
                    }
                )
            }
        }
    }

    _assess_resilient_population_event_card(actions, player, skip_check_next = false) {
        var event_card_name = "Resilient Population";
        if (player.has_event_card(event_card_name)) {
            for (const card_name of this.game.infection_deck.discarded) {
                actions.push(
                    {
                        action: event_card_name,
                        action__stop_autochoice: true,
                        player_name: player.player_name,
                        response_function: "player_resilient_population",
                        discard_card_name: event_card_name,
                        costs_an_action: false,
                        skip_check_next: skip_check_next,
                        infection_deck_card_name: card_name,
                        infection_deck_card_name__title: "Pick an Infection Card to remove",
                        is_contingency_planner_extra_card: player.is_contingency_planner_extra_card(event_card_name),
                        card_name: event_card_name
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
                        player_name__title: "Pick a player to move",
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
            var moves = [];
            this._assess_drive_ferry(moves, p, player_city, response_function)
            this._assess_direct_flight(moves, p, player_city, player_cards, response_function)
            this._assess_charter_flight(moves, p, player_city, player_cards, response_function)
            this._assess_shuttle_flight(moves, p, player_city, response_function)
            for (const m of moves) {
                m.player_name__title = "Pick a player to move";
                m.player_name_being_moved = p.player_name;
                m.player_name_causing_move = player.player_name;
                actions.push(m);
            }
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

    _assess_contingency_planner_actions(actions, player, city) {
        if (player.contingency_planner_event_card_name !== null)
            return
        for (const c of this.game.player_deck.discard_pile) {
            if (c.is_event) {
                actions.push(
                    {
                        action: "Take discarded event card",
                        player_name: player.player_name,
                        pick_up_card_name: c.card_name,
                        pick_up_card_name__title: "Pick discarded event card",
                        response_function: "player_pick_up_discarded_event_card"
                    }
                )
            }
        }
    }

    // ==================

    action_response(data) {

        // Hide everyone's selection (may have event card choices)
        this.io.to(this.game_id).emit(
            "clientAction", { function: "_hide_selections" }
        )

        // Add the next task to the queue to keep task order but don't expect any responses as server side methods
        this.game.queue.add_task(
            (d) => this._run_action(d),
            data,
            0,
            "Player action - " + data.response_function
        )
        // Can't always do check_end_of_user_turn as some responses are not a whole turn (e.g. reduce player hand size)
        this.game.queue.start();
    }

    // Event cards are free; everything else costs an action
    _action_cost(data) {
        return data.costs_an_action === false ? 0 : 1;
    }

    // Runs a player's action. If it fails, offer them their choices again rather than leave the game stuck.
    _run_action(data) {
        var recover = (err) => {
            console.error("Action " + data.response_function + " failed", err);
            this.assess_player_options();
        };
        try {
            Promise.resolve(this[data.response_function](data)).catch(recover);
        } catch (err) {
            recover(err);
        }
    }

    _add_check_end_turn_to_queue(cost = 1) {
        this.game.queue.add_task(
            this._check_end_of_user_turn,
            cost,
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
        this._show_gif("pass");
        this._add_check_end_turn_to_queue();
    }

    player_move(data) {
        var player = this._player_by_name(data.player_name)
        if (data.action == "Research Station to any city")
            player.used_special_action_this_turn = true;

        var cost = this._perform_move(player, data, () => this._discard_cards(player, data));
        if (cost === null) {
            this._add_check_end_turn_to_queue(0); // ask again
            return;
        }
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(cost);
    }

    // Moves the pawn (step by step when driving) and returns the actions it cost, or null if the move is invalid
    _perform_move(player, data, discard) {
        var path = [data.destination];
        var cost = this._action_cost(data);
        if (data.action == "Drive/Ferry") {
            path = Array.isArray(data.path) ? data.path : [data.destination];
            if (!this._is_drive_path(player.city_name, path, this._remaining_actions())) {
                console.warn("Ignoring a drive along an invalid route");
                return null;
            }
            cost = path.length;
        } else if (!this.game.cities[data.destination]) {
            return null;
        }

        var mover = this.game.current_player;
        var who = mover == player ? player.player_name : mover.player_name + " moves " + player.player_name;
        var message = path.length > 1
            ? who + (mover == player ? " drives" : " by road") + " to " + data.destination + " via " + path.slice(0, -1).join(", ") + " (" + path.length + " actions)"
            : who + (mover == player ? " moves" : "") + " (" + data.action + ") to " + data.destination;
        this.io.in(this.game_id).emit("logMessage", { message: message });

        if (data.action == "Airlift") this._show_gif("airlift");
        discard();
        for (const city_name of path)
            this._move_pawn(city_name, player, path.length > 1 ? 0.6 : 1);
        return cost;
    }

    player_treat_disease(data) {
        var colour = data.disease_colour.toLowerCase();
        var city = this.game.cities[this.game.current_player.city_name];
        var count = Math.max(1, Math.min(parseInt(data.treat_count) || 1, city.disease_cubes[colour], this._remaining_actions()));
        for (var i = 0; i < count; i++)
            this._treat_disease_for_free(colour);
        this._add_check_end_turn_to_queue(count);
    }

    player_build_research_station(data) {
        var player = this._player_by_name(data.player_name)
        if (data.remove_research_station_city_name){
            this.game.remove_research_station(data.remove_research_station_city_name)
        }
        var city_name = data.destination;
        this.game.add_research_station(city_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(this._action_cost(data));
    }

    player_cure(data) {
        var player = this._player_by_name(data.player_name);
        var colour = data.disease_colour.toLowerCase();
        var disease = this.game.diseases[colour];
        this.io.in(this.game_id).emit(
            "logMessage",
            { message: player.player_name + " cured the " + colour + " disease" }
        )
        for (const c of data.answers.discard_card_name)
            player.discard_card(c);
        this.game.player_deck.discard(data.answers.discard_card_name, player);
        disease.cure();
        //await this.game.queue.run_until_empty();
        
        for (const p of this.game.players){
            if (p.role_name == "Medic") {
                if (this.game.cities[p.city_name].disease_cubes[colour] > 0) {
                    this._treat_disease_for_free(colour, p);
                }
            }
        }
        this._add_check_end_turn_to_queue();
    }


    player_skip_next_infection_step(data) {
        this.game.skip_infection_step = true;
        this._show_gif("quiet_night");
        var player = this._player_by_name(data.player_name)
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(this._action_cost(data))
    }


    player_resilient_population(data) {
        this.game.infection_deck.remove_discarded_card(data.infection_deck_card_name)
        var player = this._player_by_name(data.player_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(this._action_cost(data))
    }

    player_forecast(data) {
        this.game.infection_deck.reorder_deck(data.answers.infection_deck_card_name) // In requested order (first to be drawn is element 0)
        var player = this._player_by_name(data.player_name);
        this._discard_cards(player, data)
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(this._action_cost(data))
    }

    player_response_cancel(data) {
        // Player responded "no"/"cancel" to a question
        return;
    }

    player_pick_up_discarded_event_card(data) {
        var player = this._player_by_name(data.player_name);
        var card_data = this.game.player_deck.pick_up_discarded_event_card(data, player);
        player.pick_up_discarded_event_card(data, card_data);
        if (!data.skip_check_next)
            this._add_check_end_turn_to_queue(this._action_cost(data))
    }

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


    _player_by_pid(pid) {
        if (!this.game) return null;
        return this.game.players.find((p) => p.pid == pid) || null;
    }

    _player_by_name(player_name) {
        for (const p of this.game.players)
            if (p.player_name == player_name)
                return p
    }

    _move_pawn(destination, player = null, dt = 1) {
        var player = player == null ? this.game.current_player : player;
        var city = this.game.cities[destination]
        player.move_pawn(city, dt);
        if (player.role_name == "Medic") {
            for (const [colour, d] of Object.entries(this.game.diseases)) {
                if (d.cured && city.disease_cubes[colour] > 0) {
                    this._treat_disease_for_free(colour, player);
                }
            }
        }
    }

    _treat_disease_for_free(colour, player=null) {
        var player = player == null ? this.game.current_player : player;
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

    async _check_end_of_user_turn(cost = 1) {
        this.game.player_used_actions += cost;
        var player = this.game.current_player;

        await this.check_disease_status();
        this.check_game_status()

        var all_actions_used = this.game.player_used_actions >= player.actions_per_turn

        if (all_actions_used) {
            this.game.round++;

            var num_cards_to_draw = 2;
            for (var i=0; i<num_cards_to_draw; i++){
                await this.game.player_deck.drawPlayerCard(player);
                await this.game.queue.run_until_empty(); // Ensure cards are dealt before maybe running reduceHandSize
            }
        }

        while (player.too_many_cards() && !this.game.queue.game_over) {
            this.reduce_player_hand_size(player);
            await this.game.queue.run_until_empty(); // Ensure cards are removed before continuing
        }

        // Next step
        if (this.game.queue.game_over)
            return;
        if (all_actions_used)
            this.end_player_turn();
        else
            this.assess_player_options();
    }

    async end_player_turn() {
        // current player's turn over, move on the next player
        await this.game.infect_cities();
        await this.game.queue.run_until_empty();
        if (this.game.queue.game_over)
            return;

        this.game.new_player_turn();
        this.assess_player_options();
        this.game.queue.start();
    }

    async check_disease_status() {
        for (const d of Object.values(this.game.diseases)) {
            if (d.eradicated)
                continue;
            if (d.cured && d.cubes_on_board == 0) {
                d.eradicate();
                await this.game.queue.run_until_empty();
            }
        }
    }

    check_game_status() {
        for (const d of Object.values(this.game.diseases)) {
            if (!d.cured)
                return
        }
        this.game.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction",
                {
                    function: "gameWin",
                    args: { message: "All diseases have been cured, you win!" }
                }
            ),
            null, "game_over", "Game won, all diseases cured!"
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
                    action__title: "Max hand size exceeded by " + n_discard,
                    response_function: "reduce_player_hand_size_response"

                }
            )
        }

        this._assess_all_event_cards(actions, player, true);

        this.game.queue.add_task(
            () => this._prompt(player, actions),
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
        this.game.player_deck.discard(discards, player, data.is_contingency_planner_extra_card)
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

        this.game.queue.add_task(
            () => {
                this._prompt(moving_player, [
                    Object.assign({ ...action }, { response: "Yes" }),
                    Object.assign({ ...action }, { response: "No" })
                ])
            }, null, 1, "Waiting for " + moving_player.player_name + " to respond to move request"
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

            var cost = this._perform_move(moving_player, data.move_proposal, () => this._discard_cards(causing_player, data.move_proposal));
            await this.game.queue.run_until_empty();

            if (cost === null)
                this.assess_player_options();
            else if (!data.move_proposal.skip_check_next)
                this._check_end_of_user_turn(cost);
        } else {
            this.io.in(this.game_id).emit(
                "logMessage",
                { message: data.move_proposal.player_name_being_moved + " refused the move" }
            )
            if (!data.move_proposal.skip_check_next)
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

        this._prompt(other_player, [
            Object.assign({ ...action }, { response: "Yes" }),
            Object.assign({ ...action }, { response: "No" })
        ])
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

            if (take_player.too_many_cards()) {
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

    // Special option to use any event cards between infect and intensify epidemic stages

    allow_players_to_use_event_cards(event_name = null) {
        var online = this.connected_player_pids();
        for (const p of this.game.players) {
            if (!online.includes(p.pid)) continue; // nobody there to decide
            var actions = [];
            if (event_name == "Resilient Population")
                this._assess_resilient_population_event_card(actions, p, true, false)
            else if (event_name == null)
                this._assess_all_event_cards(actions, p, true, false)
            else
                console.error("Other event types not implemented. " + event_name)
            if (actions.length) {
                // Possible to play an event card
                // Add a special action to not use any cards
                actions[0].action__title = "Use Your Event Card?"
                actions.push(
                    {
                        player_name: p.player_name,
                        action: "Do not use event card",
                        response_function: "player_response_cancel"
                    }
                )
                this.game.queue.add_task(
                    (player_actions) => {
                        this.io.to(this.game_id).emit(
                            "logMessage",
                            { message: p.player_name + " has a chance to use an event card..." }
                        )
                        this._prompt(p, player_actions)
                    },
                    [actions], 1, "Asking " + p.player_name + " if they want to use their event card during this special time", false, true
                )
            }
        }
    }


}

module.exports = Pandemic