jQuery(function ($) {
    'use strict';

    // Pawn colours, for dots in the players panel and games list
    var ROLE_COLOURS = {
        "Contingency Planner": "#2bb3a3",
        "Dispatcher": "#e05db0",
        "Medic": "#f08a24",
        "Operations Expert": "#8bc34a",
        "Quarantine Specialist": "#1f7a3a",
        "Researcher": "#a0682f",
        "Scientist": "#f2f2f2"
    };

    // Reaction gifs for each moment: [file, length of one loop in ms]. One is picked at random.
    var GIFS = {
        cured_red: [["cured_red.gif", 1560]],
        cured_black: [["cured_black.gif", 6800]],
        cured_yellow: [["cured_yellow.gif", 2870]],
        cured_blue: [["cured_blue.gif", 5390]],
        eradicate_red: [["eradicate_red.gif", 3300]],
        eradicate_blue: [["eradicate_blue.gif", 3610]],
        eradicate_yellow: [["eradicate_yellow.gif", 5330]],
        eradicate_black: [["eradicate_black.gif", 2040]],
        start: [["start_leeroy.gif", 3300]],
        epidemic: [["epidemic_this_is_fine.gif", 3000], ["epidemic_kermit_panic.gif", 400], ["epidemic_spongebob.gif", 3900]],
        outbreak: [["outbreak_dumpster_fire.gif", 2100], ["outbreak_krusty_krab.gif", 1200], ["outbreak_mushroom_cloud.gif", 5000]],
        chain_reaction: [["chain_conspiracy.gif", 2500], ["chain_dominoes.gif", 3100], ["chain_its_happening.gif", 1900]],
        pass: [["pass_homer_bushes.gif", 3500], ["pass_im_out.gif", 1100], ["pass_penguin.gif", 500]],
        quiet_night: [["quiet_night_homer_snoring.gif", 2000], ["quiet_night_homer_bed.gif", 3500]],
        airlift: [["airlift_superman.gif", 1200], ["airlift_superman_face.gif", 3000]],
        win: [["win.gif", 2800], ["win_dicaprio.gif", 1500]],
        lose: [["lose.gif", 2800], ["lose_titanic.gif", 3500], ["lose_crying_jordan.gif", 200], ["lose_michael_scott.gif", 2500], ["lose_pablo.gif", 3000]]
    };

    // Actions that move your own pawn, offered when you click a city on the board
    var MOVE_ACTIONS = ["Drive/Ferry", "Direct Flight", "Charter Flight", "Shuttle Flight",
        "Research Station to any city", "Airlift", "Move pawn to city with another pawn"];
    var DRIVE_COLOURS = { 1: "#4ade80", 2: "#facc15", 3: "#fb923c", 4: "#f87171" };

    function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

    function ago(time) {
        var minutes = Math.round((Date.now() - time) / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return minutes + " min ago";
        if (minutes < 60 * 24) return Math.round(minutes / 60) + " h ago";
        return Math.round(minutes / 60 / 24) + " days ago";
    }

    var IO = {

        init: function () {
            IO.socket = io();
            IO.bindEvents();
        },

        bindEvents: function () {
            IO.socket.on("connect", IO.onConnected);
            IO.socket.on("lobby", Client.showLobby);
            IO.socket.on("game_lobby", Client.showGameLobby);
            IO.socket.on("sync", Client.syncGame);
            IO.socket.on("players", Client.updatePlayers);
            IO.socket.on("gone", Client.gone);
            IO.socket.on("toast", (data) => Client.toast(data.message));
            IO.socket.on("clientAction", Client.actionDirector);
            IO.socket.on("parallel_actions", Client.parallel_actions);
            IO.socket.on("series_actions", Client.series_actions);
            IO.socket.on("logMessage", Client.logMessage);
        },

        // On every (re)connect: say who we are and what we're looking at, and the server sends the whole picture
        onConnected: function () {
            IO.socket.emit("hello", { game_id: Client.game_id, name: Client.saved_name() });
        },

        actionComplete: function () { IO.socket.emit("action_complete") }

    };

    var Client = {
        game_id: (location.pathname.match(/^\/g\/([\w-]+)/) || [])[1] || null,
        data: {
            role: null,
            player_name: null,
            current_page: null,
            player_cards: {},
            city_name: null
        },
        images: {},
        cities: [], // [name, colour, location, adjacent]
        action_data: null,
        question_order: ["action", "player_name", "remove_research_station_city_name", "destination", "disease_colour", "treat_count", "share_direction", "discard_card_name", "response", "infection_deck_card_name", "pick_up_card_name"],
        default_titles: {
            "action": "Pick an action",
            "player_name": "Pick a player",
            "destination": "Pick a destination",
            "disease_colour": "Pick a disease",
            "share_direction": "Pick a trade direction",
            "discard_card_name": "Pick a card to discard"
        },
        action_tooltips: {
            "Drive/Ferry": "Move along the white lines, one city per action.<br><br>Tip: click a city on the board to go straight there.",
            "Direct Flight": "Discard a City card to move to the city named on the card.",
            "Charter Flight": "Discard the City card that matches the city you are in to move to any city.",
            "Shuttle Flight": "Move from a city with a research station to any other city that has a research station.",
            "Build Research Station": "Discard the City card that matches the city you are in to place a research station there.<br><br>If all 6 research stations have been built, take a research station from anywhere on the board.",
            "Treat Disease": "Remove 1 disease cube from the city you are in, per action.<br>If this disease color has been cured, remove all cubes of that color from the city you are in.<br><br>If the last cube of a cured disease is removed from the board, this disease is eradicated.",
            "Share Knowledge": "You can do this action in two ways:<br>give the City card that matches the city you are in to another player,<br>or take the City card that matches the city you are in from another player.<br>The other player must also be in the city with you.<br><br>Both of you need to agree to do this.<br><br>If the player who gets the card now has more than 7 cards,<br>that player must immediately discard a card or play an Event card.",
            "Discover A Cure": "At any research station, discard 5 City cards of the same color<br>from your hand to cure the disease of that color.<br><br>If no cubes of this color are on the board, this disease is now eradicated.",
            "Pass": "Consider the chilling parallels between this innocent little game and our current reality.<br><br>Spiral in dark thoughts until your turn is over.",
            "Research Station to any city": "Once per turn, move from a research station to any city by discarding any City card."
        },
        role_tooltips: {
            "Contingency Planner": "The Contingency Planner may, as an action, take an Event card from anywhere in the Player Discard Pile and place it on his Role card. Only 1 Event card can be on his role card at a time. It does not count against his hand limit.<br><br></br>When the Contingency Planner plays the Event card on his role card, remove this Event card from the game (instead of discarding it).",
            "Dispatcher": "The Dispatcher may, as an action, either:<br><br>• move any pawn, if its owner agrees, to any city containing another pawn, or<br>• move another player’s pawn, if its owner agrees, as if it were his own.",
            "Medic": "The Medic removes all cubes, not 1, of the same color when doing the Treat Disease action.<br>If a disease has been cured, he automatically removes all cubes of that color from a city, simply by entering it or being there. This does not take an action.",
            "Operations Expert": "The Operations Expert may, as an action, either:<br><br>• build a research station in his current city without discarding (or using) a City card, or<br>• once per turn, move from a research station to any city by discarding any City card.",
            "Quarantine Specialist": "The Quarantine Specialist prevents both outbreaks and the placement of disease cubes in the city she is in and all cities connected to that city. She does not affect cubes placed during setup.",
            "Researcher": "When doing the Share Knowledge action, the Researcher may give any City card from her hand to another player in the same city as her, without this card having to match her city. The transfer must be from her hand to the other player’s hand, but it can occur on either player’s turn.",
            "Scientist": "The Scientist needs only 4 (not 5) City cards of the same disease color to Discover a Cure for that disease."
        },
        event_card_tooltips: {
            "Airlift": "Move any 1 pawn to any city.<br>Get permission before moving another player's pawn.",
            "Forecast": "Draw, look at, and rearrange the top 6 cards of the infection deck.<br>Put them back on top.",
            "Government Grant": "Add 1 research station to any city (no discard needed).",
            "One Quiet Night": "Skip the next infect cities step (do not flip over any infection cards).",
            "Resilient Population": "Remove any 1 card in the infection discard pile from the game.<br>You may play this between the infect and intensify stages of an epidemic."
        },
        text_colours: {
            "yellow": "#f5d742",
            "blue": "#7b8cff",
            "red": "#ff5a5a",
            "black": "#c9c9c9"
        },
        all_image_files: [
            "/images/pandemic_landing_image.jpg",
            "/images/game/Marker Infection Rate.png",
            "/images/game/Marker Outbreak.png",
            "/images/game/Board_1.jpg",
            "/images/game/Marker Research Station.png",
            "/images/game/vials/Vial Red Eradicated.png",
            "/images/game/vials/Vial Blue.png",
            "/images/game/vials/Vial Yellow Eradicated.png",
            "/images/game/vials/Vial Blue Eradicated.png",
            "/images/game/vials/Vial Red.png",
            "/images/game/vials/Vial Yellow.png",
            "/images/game/vials/Vial Black Eradicated.png",
            "/images/game/vials/Vial Black.png",
            "/images/game/player_cards/Card Red Shanghai.jpg",
            "/images/game/player_cards/Card Yellow Buenos Aires.jpg",
            "/images/game/player_cards/Back Player Card.gif",
            "/images/game/player_cards/Card Blue Madrid.jpg",
            "/images/game/player_cards/Card Yellow Khartoum.jpg",
            "/images/game/player_cards/Card Black Riyadh.jpg",
            "/images/game/player_cards/Card Black Delhi.jpg",
            "/images/game/player_cards/Special Event - Government Grant.jpg",
            "/images/game/player_cards/Card Red Tokyo.jpg",
            "/images/game/player_cards/Card Black Chennai.jpg",
            "/images/game/player_cards/Card Yellow Santiago.jpg",
            "/images/game/player_cards/Card Red Jakarta.jpg",
            "/images/game/player_cards/Special Event - Forecast.jpg",
            "/images/game/player_cards/Card Black Karachi.jpg",
            "/images/game/player_cards/Card Blue Washington.jpg",
            "/images/game/player_cards/Card Red Ho Chi Minh City.jpg",
            "/images/game/player_cards/Card Black Moscow.jpg",
            "/images/game/player_cards/Card Blue Essen.jpg",
            "/images/game/player_cards/Card Blue Paris.jpg",
            "/images/game/player_cards/Card Yellow Miami.jpg",
            "/images/game/player_cards/Special Event - Airlift.jpg",
            "/images/game/player_cards/Card Red Hong Kong.jpg",
            "/images/game/player_cards/Card Yellow Los Angeles.jpg",
            "/images/game/player_cards/Card Blue St. Petersburg.jpg",
            "/images/game/player_cards/Card Blue New York.jpg",
            "/images/game/player_cards/Card Yellow Johannesburg.jpg",
            "/images/game/player_cards/Card Red Bangkok.jpg",
            "/images/game/player_cards/Card Yellow Mexico City.jpg",
            "/images/game/player_cards/Card Blue Milan.jpg",
            "/images/game/player_cards/Card Red Osaka.jpg",
            "/images/game/player_cards/Card Blue San Francisco.jpg",
            "/images/game/player_cards/Card Black Kolkata.jpg",
            "/images/game/player_cards/Card Red Manila.jpg",
            "/images/game/player_cards/Card Black Cairo.jpg",
            "/images/game/player_cards/Special Event - One Quiet Night.jpg",
            "/images/game/player_cards/Card Red Sydney.jpg",
            "/images/game/player_cards/Card Blue Montreal.jpg",
            "/images/game/player_cards/Card Black Istanbul.jpg",
            "/images/game/player_cards/Special Event - Resilient Population.jpg",
            "/images/game/player_cards/Card Yellow Kinshasa.jpg",
            "/images/game/player_cards/Card Yellow Bogota.jpg",
            "/images/game/player_cards/Card Blue Chicago.jpg",
            "/images/game/player_cards/Card Yellow Sao Paulo.jpg",
            "/images/game/player_cards/Card Blue Atlanta.jpg",
            "/images/game/player_cards/Card Black Baghdad.jpg",
            "/images/game/player_cards/Card Black Mumbai.jpg",
            "/images/game/player_cards/Card Blue London.jpg",
            "/images/game/player_cards/Card Black Algiers.jpg",
            "/images/game/player_cards/Card Red Taipei.jpg",
            "/images/game/player_cards/Card Red Beijing.jpg",
            "/images/game/player_cards/Card Black Tehran.jpg",
            "/images/game/player_cards/Epidemic.jpg",
            "/images/game/player_cards/Card Yellow Lagos.jpg",
            "/images/game/player_cards/Card Red Seoul.jpg",
            "/images/game/player_cards/Card Yellow Lima.jpg",
            "/images/game/infection_deck/Infection Blue Chicago.jpg",
            "/images/game/infection_deck/Infection Black Moscow.jpg",
            "/images/game/infection_deck/Infection Blue Atlanta.jpg",
            "/images/game/infection_deck/Infection Black Karachi.jpg",
            "/images/game/infection_deck/Infection Yellow Buenos Aires.jpg",
            "/images/game/infection_deck/Infection Red Bangkok.jpg",
            "/images/game/infection_deck/Infection Yellow Miami.jpg",
            "/images/game/infection_deck/Infection Red Shanghai.jpg",
            "/images/game/infection_deck/Infection Blue Montreal.jpg",
            "/images/game/infection_deck/Infection Red Jakarta.jpg",
            "/images/game/infection_deck/Infection Black Baghdad.jpg",
            "/images/game/infection_deck/Infection Black Kolkata.jpg",
            "/images/game/infection_deck/Infection Yellow Santiago.jpg",
            "/images/game/infection_deck/Infection Blue New York.jpg",
            "/images/game/infection_deck/Infection Black Algiers.jpg",
            "/images/game/infection_deck/Infection Blue San Francisco.jpg",
            "/images/game/infection_deck/Infection Red Taipei.jpg",
            "/images/game/infection_deck/Infection Yellow Johannesburg.jpg",
            "/images/game/infection_deck/Infection Red Hong Kong.jpg",
            "/images/game/infection_deck/Infection Yellow Mexico City.jpg",
            "/images/game/infection_deck/Infection Red Sydney.jpg",
            "/images/game/infection_deck/Infection Black Istanbul.jpg",
            "/images/game/infection_deck/Infection Blue Essen.jpg",
            "/images/game/infection_deck/Infection Red Ho Chi Minh City.jpg",
            "/images/game/infection_deck/Infection Red Manila.jpg",
            "/images/game/infection_deck/Infection Yellow Lagos.jpg",
            "/images/game/infection_deck/Infection Black Tehran.jpg",
            "/images/game/infection_deck/Infection Red Osaka.jpg",
            "/images/game/infection_deck/Infection Blue St. Petersburg.jpg",
            "/images/game/infection_deck/Infection Yellow Bogota.jpg",
            "/images/game/infection_deck/Infection Red Beijing.jpg",
            "/images/game/infection_deck/Infection Yellow Lima.jpg",
            "/images/game/infection_deck/Infection Blue Washington.jpg",
            "/images/game/infection_deck/Infection Black Cairo.jpg",
            "/images/game/infection_deck/Infection Black Delhi.jpg",
            "/images/game/infection_deck/Infection Black Mumbai.jpg",
            "/images/game/infection_deck/Infection Blue Milan.jpg",
            "/images/game/infection_deck/Infection Black Riyadh.jpg",
            "/images/game/infection_deck/Infection Yellow Khartoum.jpg",
            "/images/game/infection_deck/Infection Red Tokyo.jpg",
            "/images/game/infection_deck/Infection Yellow Sao Paulo.jpg",
            "/images/game/infection_deck/Infection Blue Madrid.jpg",
            "/images/game/infection_deck/Infection Red Seoul.jpg",
            "/images/game/infection_deck/Infection Blue London.jpg",
            "/images/game/infection_deck/Infection Black Chennai.jpg",
            "/images/game/infection_deck/Infection Yellow Los Angeles.jpg",
            "/images/game/infection_deck/Infection Yellow Kinshasa.jpg",
            "/images/game/infection_deck/Back Infection.gif",
            "/images/game/infection_deck/Infection Blue Paris.jpg",
            "/images/game/roles/Pawn Operations Expert.png",
            "/images/game/roles/Role - Quarantine Specialist.jpg",
            "/images/game/roles/Role - Researcher.jpg",
            "/images/game/roles/Pawn Medic.png",
            "/images/game/roles/Role - Operations Expert.jpg",
            "/images/game/roles/Role - Contingency Planner.jpg",
            "/images/game/roles/Pawn Contingency Planner.png",
            "/images/game/roles/Pawn Scientist.png",
            "/images/game/roles/Pawn Researcher.png",
            "/images/game/roles/Role - Dispatcher.jpg",
            "/images/game/roles/Role - Scientist.jpg",
            "/images/game/roles/Role - Medic.jpg",
            "/images/game/roles/Pawn Dispatcher.png",
            "/images/game/roles/Pawn Quarantine Specialist.png",
            "/images/game/cubes/cube_red.png",
            "/images/game/cubes/cube_blue.png",
            "/images/game/cubes/cube_yellow.png",
            "/images/game/cubes/cube_black.png"
        ],

        init: function () {
            Client.$doc = $(document);
            Client.$gameArea = $('#gameArea');
            Client.templates = {
                lobby: $('#lobby-template').html(),
                gameLobby: $('#game-lobby-template').html(),
                board: $('#game-board-template').html()
            };
            Client.$gameArea.html('<div class="loader"></div>');
            Client.bindEvents();
            Client.preload_images(Client.all_image_files);
        },

        // =================================================== Action Directors
        // ALL Client functions should accept an object (dictionary)
        // data = {function: "function_name", args: [{...}], return: false/true}

        actionDirector: async function (data) {
            // Expects a single function-args combo. Always reply, even if drawing fails, so the game never waits on us.
            var ret_value;
            try {
                var fn = Client[data.function];
                if (fn) ret_value = await fn(data.args);
                else console.warn("Unknown client action " + data.function);
            } catch (err) {
                console.error(err);
            }
            if (data.return) {
                IO.actionComplete();
            }
            return ret_value;
        },

        parallel_actions: function (data) {
            // data should be an array of function-args combos
            var promises = [];
            for (const a of data.parallel_actions_args) {
                promises.push(Client.actionDirector(a))
            }
            return Promise.all(promises).then(
                () => {
                    if (data.return) {
                        IO.actionComplete()
                    }
                }
            );
        },

        series_actions: async function (data) {
            // data should be an array of function-args combos
            for (const a of data.series_actions_args) {
                await Client.actionDirector(a);
            }
            if (data.return) {
                IO.actionComplete();
            }
        },

        // ==================================================================== Pages

        _setPage: function (name, html) {
            Client.data.current_page = name;
            Client.$gameArea.html(html);
            document.documentElement.classList.toggle("on-board", name == "game_board");
            if (Client.blink_interval) clearInterval(Client.blink_interval);
            Client.action_data = null;
        },

        bindEvents: function () {
            // Games list
            Client.$doc.on("submit", "#name_form", Client.saveNameForm);
            Client.$doc.on("submit", "#create_form", Client.createGame);
            Client.$doc.on("click", ".delete-game", Client.deleteGame);
            // Game lobby
            Client.$doc.on("click", ".role-card", Client.roleCardSelected);
            Client.$doc.on("click", "#player-ready-button", Client.toggleReady);
            Client.$doc.on("click", "#start-game-button", () => IO.socket.emit("start"));
            Client.$doc.on("click", "#leave_button", Client.leaveGame);
            Client.$doc.on("click", "#copy_link_button", Client.copyLink);
            Client.$doc.on("change", '#select_n_epidemic_cards', Client.change_n_epidemic_cards);
            // Board
            Client.$doc.on("click", "#game-over-close", () => $('#gameOverDiv').removeClass("show"));
            $(window).on("resize", () => { if (Client.data.current_page == "game_board") Client.drawReachable(); });
        },

        toast: function (message) {
            var t = $('<div class="toast">').text(message);
            $('#toasts').append(t);
            setTimeout(() => t.fadeOut(300, () => t.remove()), 4000);
        },

        // The game we asked for doesn't exist (any more), or we can't join it: back to the games list
        gone: function (data) {
            if (data && data.message) Client.toast(data.message);
            Client.game_id = null;
            history.replaceState(null, "", "/");
            document.title = "Pandemic";
            IO.onConnected();
        },

        saved_name: function () {
            try { return localStorage.getItem("pandemic_name") || ""; } catch (e) { return ""; }
        },

        // ============================================ Games list

        showLobby: function (data) {
            if (Client.data.current_page != "lobby") {
                Client._setPage("lobby", Client.templates.lobby);
                $('#name_input').val(data.name || Client.saved_name());
            }
            Client.lobby_name = data.name;
            $('#name_status').text(data.name ? "Playing as " + data.name + "." : "Choose a name to create or join a game.");

            var list = $('#games_list').empty();
            if (!data.games.length)
                list.append($('<p class="empty">').text("No games yet. Create one above."));
            for (const g of data.games) {
                var card = $('<div class="game-card">').toggleClass("mine", g.mine).toggleClass("done", g.phase == "over");
                var head = $('<div class="gc-head">').append($('<strong>').text(g.title));
                if (g.mine) head.append($('<span class="badge">').text("your game"));
                var players = $('<div class="gc-players">');
                for (const p of g.players) {
                    players.append($('<span class="gc-player">').append(
                        $('<span class="dot">').css("background", ROLE_COLOURS[p.role] || "#4b5d73").attr("title", p.role || "No role yet"),
                        document.createTextNode(p.name),
                        $('<span class="online">').toggleClass("on", p.online).attr("title", p.online ? "Online" : "Offline")
                    ));
                }
                var status = $('<div class="gc-status">').text(g.status + " · " + ago(g.updated));
                card.append($('<a>').attr("href", "/g/" + g.id).append(head, players, status));
                if (g.can_delete)
                    card.append($('<div class="gc-controls">').append(
                        $('<button class="btn btn-sm btn-danger delete-game">').text("Delete").attr("data-id", g.id)
                    ));
                list.append(card);
            }
        },

        saveNameForm: function (event) {
            event.preventDefault();
            var name = $('#name_input').val().trim();
            if (!name) return;
            try { localStorage.setItem("pandemic_name", name); } catch (e) { }
            IO.socket.emit("set_name", { name: name });
        },

        createGame: function (event) {
            event.preventDefault();
            if (!Client.lobby_name) {
                Client.toast("Choose a name first.");
                $('#name_input').focus();
                return;
            }
            IO.socket.emit("create", { title: $('#title_input').val() }, (reply) => {
                if (reply && reply.id) location.href = "/g/" + reply.id;
            });
        },

        // Ask twice: deleting can't be undone
        deleteGame: function (event) {
            var button = $(event.currentTarget);
            if (!button.data("armed")) {
                button.data("armed", true).text("Delete for everyone?");
                setTimeout(() => button.data("armed", false).text("Delete"), 4000);
                return;
            }
            IO.socket.emit("delete", { id: button.attr("data-id") });
        },

        // ============================================  Game lobby: roles, epidemics, ready

        showGameLobby: function (state) {
            if (Client.data.current_page != "game_lobby")
                Client._setPage("game_lobby", Client.templates.gameLobby);
            Client.game_lobby = state;
            var me = state.members.find((m) => m.you) || null;
            Client.data.role = me ? me.role : null;
            Client.data.player_name = me ? me.name : null;
            document.title = state.title + " · Pandemic";
            $('#game_lobby_title').text(state.title);

            var list = $('#members_list').empty();
            for (const m of state.members) {
                var item = $('<li>').append(
                    $('<span class="dot">').css("background", ROLE_COLOURS[m.role] || "#4b5d73"),
                    $('<span class="name">').text(m.name + (m.you ? " (you)" : "")),
                    $('<span class="online">').toggleClass("on", m.online)
                );
                if (m.host) item.append($('<span class="badge">').text("host"));
                else if (m.ready) item.append($('<span class="ready-tag">').text("ready"));
                item.append($('<span class="role">').text(m.role || "choosing…"));
                list.append(item);
            }
            for (var i = state.members.length; i < state.max_players; i++)
                list.append($('<li class="muted">').text("Waiting for a player…"));

            $('input[name="n_epidemics_choice"][value="' + state.epidemics + '"]').prop("checked", true);
            Client.updateRoles(state);

            var host = me && me.host;
            $('#player-ready-button').toggle(!host).prop("disabled", !me || !me.role).text(me && me.ready ? "Not ready" : "I'm ready");
            $('#start-game-button').toggle(!!host).prop("disabled", !state.can_start);
            var hint = "";
            if (me && !me.role) hint = "Pick a role to play.";
            else if (host) hint = state.can_start ? (state.members.length == 1 ? "Ready to play solo, or wait for friends to join." : "Everyone's ready.") : "Waiting for everyone to pick a role and say they're ready.";
            else hint = me && me.ready ? "Waiting for the host to start." : "Say you're ready when you've picked a role.";
            $('#start_hint').text(hint);
        },

        updateRoles: function (state) {
            var taken = {};
            for (const m of state.members)
                if (m.role) taken[m.role] = m;

            var roles_list = $('#role-choice-cards-div').empty();
            for (const role of state.all_roles) {
                var owner = taken[role];
                var card_class = "role-card";
                if (owner) card_class += owner.you ? " role-card-chosen" : " role-card-unavailable";

                var role_div = $('<div class="role-card-container">');
                role_div.append($('<img>').attr({
                    "class": card_class,
                    "data-role": role,
                    "src": "/images/game/roles/Role - " + role + ".jpg",
                    "title": $('<div>').html(Client.role_tooltips[role].replace(/<br>/g, " ")).text()
                }));
                if (owner && !owner.you)
                    role_div.append($('<div class="role-player-name">').text(owner.name));
                roles_list.append(role_div);
            }
        },

        roleCardSelected: function (event) {
            if (event.target.getAttribute("class") != "role-card") // May be chosen or unavailable
                return;
            IO.socket.emit("role", { role: event.target.getAttribute("data-role") });
        },

        toggleReady: function () {
            var me = Client.game_lobby.members.find((m) => m.you);
            IO.socket.emit("ready", { ready: !(me && me.ready) });
        },

        change_n_epidemic_cards: function (event) {
            event.preventDefault();
            var number = $('input[name="n_epidemics_choice"]:checked').val();
            IO.socket.emit("epidemics", { number: number });
        },

        leaveGame: function () {
            IO.socket.emit("leave");
            location.href = "/";
        },

        copyLink: function () {
            navigator.clipboard.writeText(location.href).then(
                () => Client.toast("Invite link copied."),
                () => Client.toast("Copy this page's address to invite friends.")
            );
        },

        preload_images: function (files) {
            for (const s of files) {
                var img = new Image();
                img.src = s;
            }
        },

        // =================================================    Playing the game

        clearUserScreen: function (event) {
            Client.$gameArea.html("");
        },

        _renderBoard: function (title) {
            Client._setPage("game_board", Client.templates.board);
            Client.images = {};
            document.title = title + " · Pandemic";
            $('#game_title').text(title);

            Client.$canvasBoard = document.getElementById("boardCanvas");
            Client.$ctx = Client.$canvasBoard.getContext("2d");

            Client.$canvasBlink = document.getElementById("cubeCanvas");
            Client.$ctxBlink = Client.$canvasBlink.getContext("2d");

            Client.$canvasCard = document.getElementById("cardCanvas");
            Client.$ctxCard = Client.$canvasCard.getContext("2d");

            Client.$canvasAnimation = document.getElementById("animationCanvas");
            Client.$ctxAnimation = Client.$canvasAnimation.getContext("2d");

            Client.$canvasHighlight = document.getElementById("highlightCanvas");
            Client.$ctxHighlight = Client.$canvasHighlight.getContext("2d");
            Client.$canvasHighlight.addEventListener("click", Client.onBoardClick);
            Client.$canvasHighlight.addEventListener("mousemove", Client.onBoardHover);
            Client.$canvasHighlight.addEventListener("mouseleave", () => $('#city_hover').hide());

            Client.$playerHandStore = document.getElementById('player_card_store');
            Client.$infectionCounterLog = $("#infection_counter");
            Client.$gameLog = document.getElementById("game_log");
            Client.$playerSelectionArea = document.getElementById("player_selection_area");
            Client.$playerLocation = document.getElementById("player_location");
            Client.data.player_cards = {};

            // Cubes pulse now and then, to catch the eye
            var blink_canvas_i = 0;
            Client.blink_interval = setInterval(blink_canvas, 50);
            function blink_canvas() {
                var i_mod = blink_canvas_i % 131;
                if (i_mod > 100) {
                    var brightness = 100 * (1 + (Math.abs(Math.abs(i_mod - 115) - 15) / 15));
                    Client.$canvasBlink.style.filter = "brightness(" + brightness + "%)";
                }
                blink_canvas_i++;
            }

            Client.configure_player_role_reminder();
            Client.drawReachable();
            // The gifs are big, so only fetch them once someone's actually playing
            setTimeout(() => Client.preload_images([].concat(...Object.values(GIFS)).map((g) => "/images/gifs/" + g[0])), 5000);
        },

        startGame: function (data) {
            Client.cities = data.cities;
            Client._renderBoard(data.title);
            Client.logMessage({ message: "Game started", style: { fontWeight: "bold" } });
        },

        // Draw the whole game from the server's description, e.g. after a refresh
        syncGame: function (state) {
            Client.cities = state.cities;
            Client.data.role = state.me ? state.me.role : null;
            Client.data.player_name = state.me ? state.me.name : null;
            Client._renderBoard(state.title);
            for (const message of state.log)
                Client.logMessage(message);
            for (const image of state.images)
                Client.createImage(image); // drawn as each loads, so no need to wait
            for (const card of state.hand)
                Client.addPlayerCardToHand(card);
            Client.changeLocation(state.me ? state.me.city : "watching");
            Client.updateInfectionCounter(state.infection_count);
            Client.updatePlayerCardCount(state.cards_remaining);
            Client.updatePlayers(state.players);
            if (state.game_over)
                Client._showGameOver(state.game_over.win, state.game_over.message);
            else if (!state.me)
                Client.toast("You're watching this game.");
        },

        configure_player_role_reminder: function () {
            var role_reminder_div = document.getElementById('player-role-reminder');
            if (!Client.data.role) return;

            var wrapper_span = document.createElement("span")
            wrapper_span.setAttribute("class", "immediate-tooltip-wrapper")

            var tooltip_span = document.createElement("span")
            tooltip_span.setAttribute("class", "tooltip")
            tooltip_span.style.width = "30vw"
            tooltip_span.style.top = "5vh"
            tooltip_span.style.right = "30vw"

            var img_div = document.createElement("div")
            var role_img = document.createElement("img")
            role_img.setAttribute("src", "/images/game/roles/Role - " + Client.data.role + ".jpg")
            role_img.setAttribute("width", "50%")
            img_div.appendChild(role_img)
            tooltip_span.appendChild(img_div)
            tooltip_span.appendChild(document.createElement("br"))
            var text_div = document.createElement("div")
            text_div.innerHTML = Client.role_tooltips[Client.data.role]
            tooltip_span.appendChild(text_div)
            wrapper_span.appendChild(tooltip_span)

            role_reminder_div.appendChild(wrapper_span)
            role_reminder_div.appendChild(document.createTextNode(Client.data.role));
        },

        // =============================================   Image utils

        createImage: async function (data) {
            if (Client.data.current_page != "game_board") return;
            Client._addCtxAndCanvas(data);
            var img = await createImage(
                data.image_file,
                data.ctx,
                data.x, data.y,
                data.dx, data.dy,
                data.canvas
            )
            Client.images[data.img_name] = {
                data: data,
                img: img
            }
        },

        moveImage: function (data) {
            return move(
                Client.images[data.img_name],
                data.dest_x,
                data.dest_y,
                data.dest_dx,
                data.dest_dy,
                data.dt,
                Client.images
            );
        },

        alterImage: function (data) {
            return alter_image(
                Client.images[data.img_name],
                data.new_image_file
            )
        },

        removeImage: function (img_name) {
            var img = Client.images[img_name];
            return clearImage(img).then(
                () => { delete Client.images[img_name] }
            );
        },

        flashPawn: async function (img_name) {
            if (!Client.images[img_name]) return;
            var pawn = Client.images[img_name].data;
            var increase_factor = 5;

            var sparkle_data = { ...pawn }
            delete sparkle_data['canvas']
            delete sparkle_data['ctx']
            sparkle_data['animationCanvas'] = true
            sparkle_data['img_name'] += "_sparkle"
            sparkle_data.dt = 0.5

            var return_data = { ...sparkle_data }
            sparkle_data.dest_dx = sparkle_data.dx * increase_factor;
            sparkle_data.dest_dy = sparkle_data.dy * increase_factor;
            sparkle_data.dest_x = sparkle_data.x - (sparkle_data.dest_dx / 2);
            sparkle_data.dest_y = sparkle_data.y - (sparkle_data.dest_dy / 2);

            return_data.dest_dx = sparkle_data.dx
            return_data.dest_dy = sparkle_data.dy;
            return_data.dest_x = sparkle_data.x;
            return_data.dest_y = sparkle_data.y;

            return_data.x = sparkle_data.dest_x;
            return_data.y = sparkle_data.dest_y;
            return_data.dx = sparkle_data.dest_dx;
            return_data.dy = sparkle_data.dest_dy;

            await Client.createImage(sparkle_data)
            await Client.moveImage(sparkle_data)
            await Client.moveImage(return_data)
            await Client.removeImage(return_data.img_name)
        },

        _addCtxAndCanvas: function (data) {
            if (data.blinkCanvas) {
                data.ctx = Client.$ctxBlink;
                data.canvas = Client.$canvasBlink;
            } else if (data.cardCanvas) {
                data.ctx = Client.$ctxCard;
                data.canvas = Client.$canvasCard;
            } else if (data.animationCanvas) {
                data.ctx = Client.$ctxAnimation;
                data.canvas = Client.$canvasAnimation;
            } else {
                data.ctx = Client.$ctx;
                data.canvas = Client.$canvasBoard;
            }
        },

        // ============================================= Status panel

        updatePlayerCardCount: function (data) {
            $('#player_cards_remaining').html(data);
        },

        updateInfectionCounter: function (data) {
            Client.infection_count = data;
            var text = ""
            var totals = { 'yellow': 0, 'red': 0, 'blue': 0, 'black': 0 }
            for (const ic of data) {
                text += '<p style="margin: 0 5px; text-align: left; '
                text += ' font-weight: ' + (ic.num == 3 ? 'bold' : 'normal') + "; ";
                text += ' color: ' + Client.text_colours[ic.colour] + '; ">' + ic.city_name
                text += '<span style="float:right;">' + ic.num + '</span></p>'
                totals[ic.colour] += ic.num;
            }
            if (!Client.$infectionCounterLog) return;
            Client.$infectionCounterLog.html(text || '<p class="muted" style="margin: 0 5px">No cubes on the board</p>')
            for (const [k, v] of Object.entries(totals)) {
                $('#' + k + '_cubes_counter').text(v + '/24');
            }
        },

        // Everyone's role, city and hand (hands are open in Pandemic), and whose turn it is
        updatePlayers: function (info) {
            Client.players_info = info;
            if (Client.data.current_page != "game_board") return;
            var panel = $('#players_panel').empty();
            for (const p of info.players) {
                var cards = $('<div class="pp-cards">');
                for (const c of p.cards)
                    cards.append($('<span class="chip">').addClass(c.colour || "event").text(c.name));
                if (p.extra_card)
                    cards.append($('<span class="chip event">').text(p.extra_card + " (on role card)"));
                panel.append($('<div class="pp-player">').toggleClass("current", p.current).append(
                    $('<div class="pp-head">').append(
                        $('<span class="dot">').css("background", ROLE_COLOURS[p.role]).attr("title", p.role),
                        $('<span class="pp-name">').text(p.name),
                        $('<span class="online">').toggleClass("on", p.online).attr("title", p.online ? "Online" : "Offline"),
                        $('<span class="pp-where">').text(p.role + " · " + (p.city || "–"))
                    ),
                    cards
                ));
            }
            if (info.turn)
                Client.updatePlayerTurns({ player: info.turn.player, used_actions: info.turn.used, total_actions: info.turn.total });
        },

        updatePlayerTurns: function (data) {
            var mine = data.player == Client.data.player_name;
            var action = Math.min(data.used_actions + 1, data.total_actions);
            $('#turn_banner').toggleClass("mine", mine)
                .text((mine ? "Your turn" : data.player + "'s turn") + " · action " + action + " of " + data.total_actions);
        },

        addPlayerCardToHand: function (data) {

            var n_previous = Object.keys(Client.data.player_cards).length;
            var y_offset = 10 * n_previous
            var x_offset = 5 * (n_previous + 1);

            Client.data.player_cards[data.card_name] = data;

            var new_img = document.createElement("img");
            new_img.setAttribute("class", "player-hand-card");
            new_img.setAttribute("src", data.image_file);
            new_img.setAttribute("data-cardname", data.card_name);
            new_img.style.zIndex = n_previous;
            new_img.style.top = y_offset + "%";
            new_img.style.left = x_offset + "%";

            if (Client.$playerHandStore) Client.$playerHandStore.appendChild(new_img);
        },

        refreshPlayerHand: function () {
            Client.$playerHandStore.innerHTML = "";
            var hand = { ...Client.data.player_cards };
            Client.data.player_cards = {};
            for (const c of Object.values(hand)) {
                Client.addPlayerCardToHand(c);
            }
        },

        remove_player_card_from_hand: function (card_name) {
            delete Client.data.player_cards[card_name];
            Client.refreshPlayerHand();
        },

        logMessage: function (data) {
            if (!Client.$gameLog || Client.data.current_page != "game_board") return;
            var new_message = document.createElement("p");
            new_message.setAttribute("class", "log-message");
            new_message.innerHTML = data.message;
            if (data.style) {
                for (const [key, value] of Object.entries(data.style)) {
                    if (key == "color") {
                        new_message.style[key] = Client.text_colours[value] || value;
                    } else {
                        new_message.style[key] = value;
                    }
                }
            }
            Client.$gameLog.prepend(new_message);
        },

        changeLocation: function (city_name) {
            Client.data.city_name = city_name;
            if (Client.$playerLocation) Client.$playerLocation.textContent = city_name;
        },

        // ============================================= Choosing actions

        enableActions: function (data) {
            Client._hide_form();
            Client.action_data = data;
            Client.present_actions(Client.action_data);
            Client.drawReachable();
        },

        _send: function (action, answers = {}) {
            var response_data = Object.assign({ ...action }, { answers: answers });
            Client._hide_selections();
            IO.socket.emit("action_response", response_data);
        },

        present_actions: function (remaining_actions, level = 0, answers = null) {
            if (level > 20) {
                Client.toast("Something has gone wrong");
                console.error(remaining_actions)
                return
            }

            answers = answers == null ? {} : answers;
            var question = Client.question_order[level];

            if (remaining_actions.length == 1 && !remaining_actions[0][question + "__stop_autochoice"]) {
                // Single choice left, use it
                Client._send(remaining_actions[0], answers);
                return;
            }

            if (Object.keys(remaining_actions[0]).includes(question)) {
                var labels = {}, colours = {};
                for (const a of remaining_actions) {
                    if (a[question + "__label"]) labels[a[question]] = a[question + "__label"];
                    if (a[question + "__colour"]) colours[a[question]] = a[question + "__colour"];
                }
                Client._ask_question(
                    array_from_objects_list(remaining_actions, question, true),
                    (answer) => {
                        var new_remaining_actions = remaining_actions.filter(
                            (a) => { return a[question] == answer; }
                        );
                        // We may have chosen multiple options which do not correspond to a single option in the array
                        // If this is the case, chose a single option from the available ones to maintain metadata in the options object
                        if (!new_remaining_actions.length) {
                            new_remaining_actions = [{ ...remaining_actions[0] }];
                            // We remove the false data that was not chosen
                            delete new_remaining_actions[0][question];
                        }
                        answers[question] = answer;
                        Client.present_actions(new_remaining_actions, level + 1, answers);
                    },
                    remaining_actions[0][question + "__n_choices"] || 1,
                    colours,
                    level > 0 && remaining_actions[0][question + "__cancel_button"] !== false,
                    remaining_actions[0][question + "__title"] || Client.default_titles[question] || null,
                    remaining_actions[0][question + "__checkboxes"] || false,
                    remaining_actions[0][question + "__sortable"] || false,
                    remaining_actions[0][question + "__stop_autochoice"] || false,
                    labels
                )
            } else {
                Client.present_actions(remaining_actions, level + 1, answers)
            }
        },

        _ask_question: function (
            options,
            go_callback = null,
            n_choices = 1,
            colours = {},
            cancel_button = true,
            title = null,
            checkboxes = false,
            sortable = false,
            stop_autochoice = false,
            labels = {}
        ) {

            if (!stop_autochoice && !sortable) {
                if (options.length == 1 && n_choices == 1) {
                    go_callback(options[0])
                    return;
                } else if (options.length == n_choices) {
                    go_callback(options)
                    return;
                }
            }

            var form = document.createElement("form");
            form.style.width = "100%"
            var input_type = checkboxes ? "checkbox" : (sortable ? "sortable" : "radio");

            if (title) {
                var heading = document.createElement("h3");
                heading.textContent = title;
                form.appendChild(heading)
            }

            if (sortable) {
                // Sortable list
                var list = document.createElement("ul")
                list.setAttribute("id", "sortable")

                for (const o of options) {
                    var list_entry = document.createElement("li");
                    list_entry.setAttribute("class", "ui-state-default sortable-choice");
                    list_entry.setAttribute("data-city-name", o);

                    list_entry.textContent = "⬍   " + o;
                    list_entry.style.color = { yellow: "#8a6d00", red: "#b00000", blue: "#2730c0", black: "#000" }[colours[o]] || "";

                    list.appendChild(list_entry)
                }

                form.appendChild(list);

            } else {
                // Checkboxes / radios
                for (var i = 0; i < options.length; i++) {
                    var o = options[i];
                    var colour = colours[o];

                    var input = document.createElement("input");
                    input.setAttribute("type", input_type);
                    input.setAttribute("value", o);
                    input.setAttribute("name", "choice");
                    input.className = "input_form_choice"
                    var id = "form_input_" + i;
                    input.setAttribute("id", id);

                    var label = document.createElement("label");
                    label.setAttribute("for", id);
                    if (colour) label.style.color = Client.text_colours[colour];
                    label.textContent = labels[o] || o;
                    label.setAttribute("class", "has-tooltip")

                    var tooltip = Client.action_tooltips[o] || Client.event_card_tooltips[o] || null;
                    if (tooltip != null) {
                        var wrapper_span = document.createElement("span")
                        wrapper_span.setAttribute("class", "tooltip-wrapper")
                        var tooltip_span = document.createElement("span")
                        tooltip_span.setAttribute("class", "tooltip action-tooltip")
                        tooltip_span.innerHTML = tooltip;
                        wrapper_span.appendChild(tooltip_span)
                        label.appendChild(wrapper_span)
                    }
                    form.appendChild(input);
                    form.appendChild(label);
                    form.appendChild(document.createElement("br"));
                }
            }

            var button_div = document.createElement("div");
            button_div.className = "selection-buttons";
            form.appendChild(button_div)

            if (cancel_button) {
                var cancel_btn = document.createElement("button");
                cancel_btn.className = "btn btn-sm";
                cancel_btn.innerHTML = "Cancel";
                cancel_btn.onclick = function (event) {
                    event.preventDefault();
                    Client._hide_form();
                    Client.present_actions(Client.action_data);
                }
                button_div.appendChild(cancel_btn);
            }

            var ok_btn = document.createElement("button");
            ok_btn.className = "btn btn-sm btn-primary";
            ok_btn.innerHTML = "Go";
            ok_btn.onclick = function (event) {
                event.preventDefault();
                $('#player_selection_area').stop()
                var selection = null;
                if (checkboxes) {
                    selection = [];
                    for (const i of form.getElementsByClassName("input_form_choice"))
                        if (i.checked)
                            selection.push(i.value)
                } else if (sortable) {
                    selection = [];
                    for (const i of form.getElementsByClassName("sortable-choice"))
                        selection.push(i.getAttribute("data-city-name"))
                } else {
                    selection = form.querySelector('input[name="choice"]:checked').value;
                }
                Client._hide_form();
                if (go_callback)
                    go_callback(selection);
            }
            button_div.appendChild(ok_btn);

            Client.$playerSelectionArea.appendChild(form);
            Client._show_selections();

            var inputs = form.getElementsByClassName("input_form_choice");
            if (checkboxes) {
                ok_btn.disabled = true;
                var checkFunc = function () {
                    var count = 0;
                    for (const i of inputs)
                        if (i.checked) count++;
                    for (const i of inputs)
                        if (!i.checked) i.disabled = count >= n_choices;
                    ok_btn.disabled = count < n_choices;
                };
                for (const i of inputs) i.onclick = checkFunc;
            } else if (sortable) {
                ok_btn.disabled = false;
            } else {
                // radios: double-click to go straight away, and a lone option is already picked
                ok_btn.disabled = inputs.length != 1;
                if (inputs.length == 1) inputs[0].checked = true;
                for (const i of inputs) {
                    i.onclick = () => { ok_btn.disabled = false; };
                    i.ondblclick = () => ok_btn.click();
                }
                for (const l of form.getElementsByTagName("label"))
                    l.ondblclick = () => ok_btn.click();
            }
        },

        _show_selections: function () {
            Client.$playerSelectionArea.style.height = "30vh";
            Client.$gameLog.style.height = "10vh";
            Client.$playerSelectionArea.scrollTop = 0;

            $(function () {
                $("#sortable").sortable();
                $("#sortable").disableSelection();
            });
        },

        // The server says someone acted, so nobody else's choices stand any more
        _hide_selections: function () {
            Client.action_data = null;
            Client._hide_form();
            Client.drawReachable();
        },

        _hide_form: function () {
            if (!Client.$playerSelectionArea) return;
            Client.$playerSelectionArea.innerHTML = "";
            Client.$playerSelectionArea.style.height = "0px";
            Client.$gameLog.style.height = "22vh"
        },

        // ============================================= Moving by clicking the board

        _city_centre: function (city) {
            // Locations are the top left of a city's marker
            return [city[2][0] + 0.01, city[2][1] + 0.012];
        },

        _city_at: function (event) {
            var rect = Client.$canvasHighlight.getBoundingClientRect();
            var best = null, best_distance = Math.max(14, rect.width * 0.014);
            for (const city of Client.cities) {
                var [cx, cy] = Client._city_centre(city);
                var d = Math.hypot(event.clientX - (rect.left + cx * rect.width), event.clientY - (rect.top + cy * rect.height));
                if (d < best_distance) {
                    best = city[0];
                    best_distance = d;
                }
            }
            return best;
        },

        _my_moves_to: function (city_name) {
            return (Client.action_data || []).filter((a) =>
                a.destination == city_name && a.player_name == Client.data.player_name &&
                a.response_function == "player_move" && MOVE_ACTIONS.includes(a.action));
        },

        _move_label: function (a) {
            switch (a.action) {
                case "Drive/Ferry":
                    return a.path && a.path.length > 1
                        ? "Drive via " + a.path.slice(0, -1).join(" → ") + " (" + a.path.length + " actions)"
                        : "Drive/Ferry (1 action)";
                case "Direct Flight": return "Direct flight, discarding " + a.discard_card_name;
                case "Charter Flight": return "Charter flight, discarding " + a.discard_card_name;
                case "Shuttle Flight": return "Shuttle flight between research stations";
                case "Research Station to any city": return "Fly from the research station, discarding " + a.discard_card_name;
                case "Airlift": return "Airlift (event card, no action)";
                default: return a.action;
            }
        },

        onBoardClick: function (event) {
            var city = Client._city_at(event);
            if (!city || !Client.action_data) return;
            var moves = Client._my_moves_to(city);
            if (!moves.length) {
                if (city != Client.data.city_name && Client.action_data.some((a) => a.action == "Pass"))
                    Client.toast("You can't get to " + city + " this turn.");
                return;
            }
            // A single step along a road or a shuttle flight costs nothing extra: just go
            var simple = (m) => (m.action == "Drive/Ferry" && m.actions_cost == 1) || m.action == "Shuttle Flight";
            if (moves.length == 1 && simple(moves[0])) {
                Client._send(moves[0]);
                return;
            }
            Client._hide_form();
            var labels = {};
            moves.forEach((m, i) => { labels[i] = Client._move_label(m); });
            Client._ask_question(Object.keys(labels), (i) => Client._send(moves[i]), 1, {}, true,
                "Get to " + city + " by…", false, false, true, labels);
        },

        onBoardHover: function (event) {
            var city = Client._city_at(event);
            var hover = $('#city_hover');
            if (!city) {
                hover.hide();
                Client.$canvasHighlight.style.cursor = "default";
                return;
            }
            var text = city;
            var cubes = (Client.infection_count || []).filter((ic) => ic.city_name == city).map((ic) => ic.num + " " + ic.colour);
            if (cubes.length) text += " · " + cubes.join(", ");
            var moves = Client._my_moves_to(city);
            var drive = moves.find((m) => m.action == "Drive/Ferry");
            if (drive) text += " · drive, " + drive.actions_cost + (drive.actions_cost == 1 ? " action" : " actions");
            else if (moves.length) text += " · " + moves.length + (moves.length == 1 ? " way" : " ways") + " to get there";
            Client.$canvasHighlight.style.cursor = moves.length ? "pointer" : "default";
            var rect = Client.$canvasHighlight.getBoundingClientRect();
            hover.text(text).css({ left: event.clientX - rect.left, top: event.clientY - rect.top }).show();
        },

        // Rings around the cities you can drive to (coloured by how many actions), planes on ones you can fly to
        drawReachable: function () {
            var canvas = Client.$canvasHighlight;
            if (!canvas) return;
            var ratio = window.devicePixelRatio || 1;
            canvas.width = canvas.clientWidth * ratio;
            canvas.height = canvas.clientHeight * ratio;
            var ctx = Client.$ctxHighlight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!Client.action_data) return;

            var drives = {}, flights = new Set();
            for (const a of Client.action_data) {
                if (a.player_name != Client.data.player_name || a.response_function != "player_move") continue;
                if (a.action == "Drive/Ferry") drives[a.destination] = Math.min(drives[a.destination] || 9, a.actions_cost || 1);
                else if (a.action == "Direct Flight" || a.action == "Shuttle Flight") flights.add(a.destination);
            }
            var radius = canvas.width * 0.009;
            for (const city of Client.cities) {
                var [cx, cy] = Client._city_centre(city);
                var x = cx * canvas.width, y = cy * canvas.height;
                var cost = drives[city[0]];
                if (cost) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI);
                    ctx.lineWidth = 2.5 * ratio;
                    ctx.strokeStyle = DRIVE_COLOURS[cost] || "#fff";
                    ctx.shadowColor = DRIVE_COLOURS[cost] || "#fff";
                    ctx.shadowBlur = 8 * ratio;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.beginPath();
                    ctx.arc(x + radius, y - radius, radius * 0.55, 0, 2 * Math.PI);
                    ctx.fillStyle = DRIVE_COLOURS[cost] || "#fff";
                    ctx.fill();
                    ctx.fillStyle = "#111";
                    ctx.font = "bold " + Math.round(radius * 0.8) + "px system-ui";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(String(cost), x + radius, y - radius + 0.5);
                } else if (flights.has(city[0])) {
                    ctx.font = Math.round(radius * 1.3) + "px system-ui";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#4fd1ff";
                    ctx.fillText("✈", x + radius, y - radius);
                }
            }
        },

        // ============================================= Gifs and the end of the game

        showGif: function (kind) {
            var options = GIFS[kind];
            var div = document.getElementById("gifsDiv");
            if (!options || !div) return Promise.resolve();
            var [file, loop_ms] = pick(options);
            // Short loops repeat so everyone has time to see them
            var ms = Math.min(7000, loop_ms * Math.max(1, Math.ceil(2500 / loop_ms)));
            var img = document.createElement("img");
            img.src = "/images/gifs/" + file;
            div.innerHTML = "";
            div.appendChild(img);
            div.classList.add("show");
            return new Promise((resolve) => setTimeout(() => {
                div.classList.remove("show");
                setTimeout(() => { if (img.parentNode == div) div.removeChild(img); resolve(); }, 250);
            }, ms));
        },

        diseaseEradicated: function (disease_colour) {
            return Client.showGif("eradicate_" + disease_colour);
        },

        diseaseCured: function (disease_colour) {
            return Client.showGif("cured_" + disease_colour);
        },

        gameLose: function (data) {
            Client._showGameOver(false, data.message);
        },

        gameWin: function (data) {
            Client._showGameOver(true, data.message);
        },

        _showGameOver: function (win, message) {
            Client._hide_selections();
            $('#game-over-title').text(win ? "You saved the world!" : "Game over");
            $('#game-over-message').text(message);
            $('#game-over-img').attr("src", "/images/gifs/" + pick(GIFS[win ? "win" : "lose"])[0]);
            $('#gameOverDiv').addClass("show");
            $('#turn_banner').removeClass("mine").text(win ? "Won!" : "Game over");
        }

    }

    Client.init();
    IO.init();

}($));
