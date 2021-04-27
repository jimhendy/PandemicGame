jQuery(function ($) {
    'use strict';

    var IO = {

        init: function () {
            IO.socket = io();
            IO.bindEvents();
        },

        bindEvents: function () {

            IO.socket.on("connected", IO.onConnected);
            IO.socket.on("error", IO.error);

            // Game setup
            IO.socket.on("clearUserScreen", Client.clearUserScreen);
            IO.socket.on("reloadLandingScreen", Client.showLandingScreen);
            IO.socket.on("userJoinRoom", Client.showRoleChoiceScreen);
            IO.socket.on("reloadRolesSelection", Client.updateRoles);

            // Game
            IO.socket.on('startGame', Client.startGame)
            IO.socket.on("createImage", Client.createImage);
            IO.socket.on("moveImage", Client.moveImage);
            IO.socket.on("alterImage", Client.alterImage);
            IO.socket.on("removeImage", Client.removeImage);

            IO.socket.on("logMessage", Client.logMessage);
            IO.socket.on("updateInfectionCounter", Client.updateInfectionCounter);
            IO.socket.on("colourToCitiesMap", (map) => {Client.colour_to_cities = map;})

            IO.socket.on("discardInfectionCard", Client.discardInfectionCard);
            IO.socket.on("drawInfectionCards", Client.drawInfectionCards);
            IO.socket.on("newPlayerCards", Client.receivePlayerCards);
            IO.socket.on("newPlayersTurn", Client.newPlayerTurn);
            IO.socket.on("discardPlayerCardFromHand", Client.remove_player_card_from_hand);
            IO.socket.on("discardPlayerCards", Client.discardPlayerCards);
            IO.socket.on("reducePlayerHand", Client.reducePlayerHand);

            IO.socket.on("epidemicDraw", Client.epidemicDraw);

            IO.socket.on("enableActions", Client.enableActions);
            IO.socket.on("disableActions", Client.disableActions);

            IO.socket.on("changeLocation", Client.changeLocation);
            IO.socket.on("updatePlayerTurns", Client.updatePlayerTurns);

            IO.socket.on("incoming_shareKnowledgeProposal", Client.incoming_shareKnowledgeProposal);
            IO.socket.on("addPlayerCardToHand", Client.addPlayerCardToHand)

            IO.socket.on("gameOver", Client.gameOver);
        },

        onConnected: function () {
            Client.data.socket_id = IO.socket.id;
        },

        error: function (data) {
            alert(data.message);
        }

    };

    var Client = {
        data: {
            socket_id: null,
            role: null,
            passcode: null,
            player_name: null,
            current_page: null,
            city_cards: {},
            event_cards: {},
            player_cards: {},
            loaction: "Atlanta"
        },
        images: {},
        button_names: ["drive_ferry", "direct_flight", "charter_flight", "shuttle_flight", "build_research_station", "treat_disease", "cure", "share_knowledge", "special_action", "pass"],

        init: function () {
            Client.cacheElements();
            Client.showLandingScreen();
            Client.bindEvents();
        },

        cacheElements: function () {
            Client.$doc = $(document);

            // Templates
            Client.$gameArea = $('#gameArea');
            Client.$landingScreen = $('#landing-screen-template').html();
            Client.$roleChoiceScreen = $('#role-choice-screen-template').html();
            Client.$waitingForRolesTemplate = $('#waiting-for-role-choices-template').html();
            Client.$gameBoardTemplate = $('#game-board-template').html()
            Client.$gameOverTemplate = $('#game-over-template').html()
        },

        showLandingScreen: function () {
            Client.$gameArea.html(Client.$landingScreen);
            Client.data.current_page = "landing";
        },

        showRoleChoiceScreen: function (data) {
            Client.$gameArea.html(Client.$roleChoiceScreen);
            Client.data.current_page = "role_choice";
            Client.updateRoles(data);
        },

        updateRoles: function (data) {
            if (Client.data.current_page != "role_choice") {
                console.error("Client asked to update roles but not on correct page")
                console.error(Client.data)
                return;
            }

            // Images
            var roles_list = '<div id="roles_list" style="display: flex;">';
            for (const role of data.all_roles) {
                var card_class = "role-card";
                var role_name = "";
                if (Object.values(data.assigned_roles).includes(role)) {
                    if (Client.data.role == role) {
                        card_class += " role-card-chosen";
                    } else {
                        card_class += " role-card-unavailable";
                        role_name = key_from_value(data.assigned_roles, role);
                    }
                }
                roles_list += '<div class="role-card-container">'
                roles_list += '<img class="' + card_class + '" '
                roles_list += 'data-role="' + role + '" '
                roles_list += 'src="/images/game/roles/Role - ' + role + '.jpg">'
                roles_list += '<div class="centered role-player-name">'
                roles_list += role_name + '</div>'
                roles_list += '</div>'
            }
            roles_list += "</div>";
            $('#role-choice-cards-div').html(roles_list);
        },

        bindEvents: function () {
            Client.$doc.on("submit", "#player_details_form", Client.playerJoinForm);
            Client.$doc.on("click", ".role-card", Client.roleCardSelected);
            Client.$doc.on("click", "#player-ready-button", Client.waitForOtherRoles)

            Client.$doc.on("click", "#button_drive_ferry", Client.drive_ferry);
            Client.$doc.on("click", "#button_direct_flight", Client.direct_flight);
            Client.$doc.on("click", "#button_charter_flight", Client.charter_flight);
            Client.$doc.on("click", "#button_shuttle_flight", Client.shuttle_flight);
            Client.$doc.on("click", "#button_treat_disease", Client.treatDisease);
            Client.$doc.on("click", "#button_build_research_station", () => IO.socket.emit("build_research_station"));
            Client.$doc.on("click", "#button_share_knowledge", Client.share_knowledge);
            Client.$doc.on("click", "#button_cure", Client.cure);
            Client.$doc.on("click", "#button_pass", () => IO.socket.emit("pass"));
        },

        waitForOtherRoles: function () {
            Client.$gameArea.html(Client.$waitingForRolesTemplate);
            Client.data.current_page = "waiting_for_roles";
            IO.socket.emit("waiting_for_other_roles");
        },

        playerJoinForm: function (event) {
            event.preventDefault();
            Client.data['passcode'] = $('#passcode_input').val();
            Client.data['player_name'] = $('#playername_input').val();
            IO.socket.emit("playerJoinAttempt", Client.data);
        },

        roleCardSelected: function (event) {
            if (event.target.getAttribute("class") != "role-card") // May be chosen or unavailable
                return;
            var role = event.target.getAttribute("data-role");
            Client.data.role = role;
            IO.socket.emit("roleChosen", Client.data);
            $('#player-ready-button').attr("disabled", false);
        },

        clearUserScreen: function (event) {
            Client.$gameArea.html("");
        },

        startGame: function (data) {
            Client.$gameArea.html(Client.$gameBoardTemplate);
            Client.data.current_page = "game_board";

            Client.$canvasBoard = document.getElementById("boardCanvas");
            Client.$ctx = Client.$canvasBoard.getContext("2d");

            Client.$canvasBlink = document.getElementById("cubeCanvas");
            Client.$ctxBlink = Client.$canvasBlink.getContext("2d");

            Client.$canvasCard = document.getElementById("cardCanvas");
            Client.$ctxCard = Client.$canvasCard.getContext("2d");

            Client.$canvasAnimation = document.getElementById("animationCanvas");
            Client.$ctxAnimation = Client.$canvasAnimation.getContext("2d");

            Client.$playerHandStore = document.getElementById('player_card_store');
            Client.$currentPlayerDiv = document.getElementById('current_player');

            var blink_canvas_i = 0;
            setInterval(blink_canvas, 50);
            function blink_canvas() {
                var i_mod = blink_canvas_i % 131;
                if (i_mod > 100)
                    Client.$canvasBlink.style.opacity = Math.abs(i_mod - 115) / 15;
                blink_canvas_i++;
            }

            Client.$infectionCounterLog = $("#infection_counter");
            Client.$gameLog = document.getElementById("game_log");
            Client.$playerSelectionArea = document.getElementById("player_selection_area");
            Client.$playerActionsArea = document.getElementById("player_actions");
            Client.$playerLocation = document.getElementById("player_location")

            Client.$buttons = {};
            for (const b of Client.button_names) {
                Client.$buttons[b] = document.getElementById('button_' + b);
            }
        },

        createImage: function (data) {
            Client._addCtxAndCanvas(data);
            //if (Object.keys(Client.images).includes(data.img_name))
            //    console.log("Image name already exists: " + data.img_name)
            Client.images[data.img_name] = {
                data: data,
                img: createImage(
                    data.image_file,
                    data.ctx,
                    data.x, data.y,
                    data.dx, data.dy,
                    data.canvas
                )
            };
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

        updateInfectionCounter: function (text) {
            Client.$infectionCounterLog.html(text);
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
            ).then(
                () => clearAndRedrawCanvas(Client.images[data.img_name], Client.images)
            )
        },

        alterImage: function (data) {
            alter_image(
                Client.images[data.img_name],
                data.new_image_file
            )
        },

        removeImage: function (img_name) {
            var img = Client.images[img_name];
            clearImage(img)
            delete Client.images[img_name];
        },

        receivePlayerCards: async function (cards) {
            for (let c of cards) {
                await Client.receivePlayerCard(c);
            }
            IO.socket.emit("playerCardsReceived");
        },

        receivePlayerCard: function (card_data) {
            var data = {
                img_type: "flying_card",
                img_name: "flying_card_" + card_data.img_name,
                image_file: card_data.image_file,
                x: card_data.x,
                y: card_data.y,
                dx: card_data.dx,
                dy: card_data.dy,
                dest_x: 0.3,
                dest_y: 0.2,
                dest_dx: 0.3,
                dest_dy: 0.6,
                dt: 0.5,
                animationCanvas: true
            }
            if (card_data.is_epidemic){
                return new Promise((resolve)=>{
                    Client.createImage(data);
                    Client.moveImage(data).then(
                        () => {
                            data.dt = 1;
                            Client.moveImage(data).then(
                                () => {
                                    Client.removeImage(data.img_name);
                                    resolve();
                                }
                            )
                        }
                    )
                })
            } else {
                return new Promise((resolve, reject) => {
                    Client.createImage(data);
                    Client.moveImage(data).then(
                        () => {
                            data.dest_x = 1.2;
                            data.dt = 0.5;
                            Client.moveImage(data).then(
                                () => {
                                    Client.removeImage(data.img_name);
                                    Client.addPlayerCardToHand(card_data);
                                    resolve();
                                }
                            );
                        }
                    );
                });
            }
        },

        discardPlayerCards: async function (cards) {
            for (let c of cards) {
                await Client.discardPlayerCard(c);
            }
            IO.socket.emit("playerCardDiscarded");
        },

        discardPlayerCard: function (card_data) {
            return new Promise((resolve, reject) => {
                Client.createImage(card_data);
                Client.moveImage(card_data).then(() => { resolve(); });
            })
        },

        addPlayerCardToHand: function (data) {

            var n_previous = Object.keys(Client.data.player_cards).length;
            var y_offset = 10 * n_previous
            var x_offset = 5 * (n_previous + 1);

            Client.data.player_cards[data.card_name] = data;
            if (data.is_city)
                Client.data.city_cards[data.card_name] = data;
            else if (data.is_event)
                Client.data.event_cards[data.card_name] = data;
            else
                IO.error({message: "Bad card found " + data})

            var new_img = document.createElement("img");
            new_img.setAttribute("class", "player-hand-card");
            new_img.setAttribute("src", data.image_file);
            new_img.setAttribute("z-order", n_previous);
            new_img.setAttribute("data-cardname", data.card_name);
            new_img.style.top = y_offset + "%";
            new_img.style.left = x_offset + "%";

            Client.$playerHandStore.appendChild(new_img);
        },

        refreshPlayerHand: function () {
            Client.$playerHandStore.innerHTML = "";
            var hand = { ...Client.data.player_cards };
            Client.data.player_cards = {};
            for (const c of Object.values(hand)) {
                Client.addPlayerCardToHand(c);
            }
        },

        logMessage: function (data) {
            var new_message = document.createElement("p");
            new_message.setAttribute("class", "log-message");
            new_message.textContent = data.message;
            if (Object.keys(data).includes("style")) {
                for (const [key, value] of Object.entries(data.style)) {
                    new_message.style[key] = value;
                }
            }
            Client.$gameLog.prepend(new_message);
        },

        discardInfectionCard: function (data) {
            if (Object.keys(Client.images).includes(data.img_name)) {
                Client.removeImage(data.img_name)
            }
            Client.createImage(data);
        },

        newPlayerTurn: function (player_name) {
            Client.$currentPlayerDiv.textContent = player_name
            if (player_name != Client.data.player_name)
                return;
            IO.socket.emit("enquireAvailableActions", Client.data);
        },

        enableActions: function (data) {
            Client.actions_data = data;
            for (const btn of Client.button_names) {
                Client.$buttons[btn].disabled = !(data.actions.includes(btn))
            }
        },

        drive_ferry: function () {
            Client._ask_question(
                Client.actions_data.adjacent_cities,
                (destination) => IO.socket.emit("player_drive_ferry", destination)
            );
        },

        direct_flight: function () {
            Client._ask_question(
                Object.keys(Client.data.city_cards),
                (destination) => IO.socket.emit("player_direct_flight", destination)
            );
        },

        treatDisease: function(data){
            function reply_func(colour) { IO.socket.emit("treatDisease", {colour: colour}); };
            var available_colours = [];
            for (const [colour, num] of Object.entries(Client.actions_data.current_city_cubes)){
                if (num > 0){
                    available_colours.push(colour);
                }
            }
            if (available_colours.length == 1){
                reply_func(available_colours[0]);
            } else {
                Client._ask_question(
                    available_colours,
                    (colour) => reply_func(colour),
                    1,
                    null,
                    true,
                    "Treat which disease?",
                    false
                )
            }
            
        },

        remove_player_card_from_hand: function (card_name) {
            delete Client.data.player_cards[card_name];
            if (Object.keys(Client.data.city_cards).includes(card_name))
                delete Client.data.city_cards[card_name]
            if (Object.keys(Client.data.event_cards).includes(card_name))
                delete Client.data.event_cards[card_name]                
            Client.refreshPlayerHand();
        },

        disableActions: function () {
            for (const btn of Client.button_names) {
                Client.$buttons[btn].disabled = true;
            }
        },

        changeLocation: function (city_name) {
            Client.data.city_name = city_name;
            Client.$playerLocation.textContent = city_name;
        },

        updatePlayerTurns: function (data) {
            Client.$currentPlayerDiv.textContent = data.player + " (" + parseInt(data.used_actions + 1) + "/" + data.total_actions + ")"
        },

        reducePlayerHand: function (data) {
            var current_hand_size = data.current_cards.length;
            var n_discard = current_hand_size - data.max_cards
            var heading = "Select " + n_discard + (n_discard == 1 ? " card" : " cards") + " to discard"
            Client._ask_question(
                data.current_cards,
                (cards) => { IO.socket.emit("submitReducePlayerHand", cards) },
                n_discard,
                null,
                false,
                heading,
                true
            )
        },

        drawInfectionCards: async function (data) {
            for (var i = 0; i < data.cards.length; i++) {
                if (i - 1 == data.empty_deck_deal) {
                    Client.createImage(data.infection_deck_image_data)
                }
                await Client.drawSingleInfectionCard(data.cards[i])
                if (i == data.empty_deck_deal) {
                    Client.removeImage("infection_deck")
                }
            }
        },

        drawSingleInfectionCard(card_data) {
            return new Promise((resolve, reject) => {
                Client.createImage(card_data);
                Client.moveImage(card_data).then(() => { resolve(); });
            })
        },

        epidemicDraw: async function(data){
            for (var i = 0; i < data.cards.length; i++) {
                Client.createImage(data.cards[i]);
                await Client.moveImage(data.cards[i]).then(() => {
                    Client.removeImage("infection_discard")
                });
            }
        },

        shuttle_flight: function (data) {
            var possible_destinations = Client.actions_data.research_station_cities.filter(
                (d) => { return d != Client.data.city_name }
            )
            Client._ask_question(
                possible_destinations,
                (destination) => IO.socket.emit("player_shuttle_flight", destination)
            );
        },

        charter_flight: function () {
            var colours = [];
            var possible_destinations = [];
            for (const [colour, cities] of Object.entries(Client.colour_to_cities)) {
                for (const c of cities) {
                    if (c == Client.data.city_name)
                        continue;
                    possible_destinations.push(c);
                    colours.push(colour);
                }
            }
            Client._ask_question(
                possible_destinations,
                (destination) => IO.socket.emit(
                    "player_charter_flight",
                    {
                        destination_city_name: destination,
                        origin_city_name: Client.data.city_name
                    }),
                1,
                colours
            );
        },

        _ask_question: function (
            options,
            go_callback = null,
            n_choices = 1,
            colours = null,
            cancel_button = true,
            title = null,
            checkboxes = false
        ) {

            var form = document.createElement("form");
            form.style.width = "100%"
            var input_type = checkboxes ? "checkbox" : "radio";

            if (title) {
                var heading = document.createElement("h3");
                heading.textContent = title;
                form.appendChild(heading)
            }

            for (var i = 0; i < options.length; i++) {
                var o = options[i];
                var colour = colours === null ? null : colours[i];
                var input = document.createElement("input");
                input.setAttribute("type", input_type);
                input.setAttribute("value", o);
                input.setAttribute("name", "choice");
                input.className = "input_form_choice"
                var id = "form_input_" + o;
                input.setAttribute("id", id);
                var label = document.createElement("label");
                label.setAttribute("for", id);
                label.style.color = colour;
                if (colour && colour.toLowerCase() == "yellow")
                    label.style.backgroundColor = "#bfbfbd"
                label.textContent = o;
                var br = document.createElement("br");
                form.appendChild(input);
                form.appendChild(label);
                form.appendChild(br);
            }

            var button_div = document.createElement("div");
            button_div.style.display = "flex"
            button_div.style.justifyContent = "center";
            button_div.style.marginTop = "5px"
            form.appendChild(button_div)

            if (cancel_button) {
                var cancel_btn = document.createElement("button");
                cancel_btn.innerHTML = "Cancel";
                cancel_btn.onclick = function (event) {
                    event.preventDefault();
                    Client.$playerSelectionArea.innerHTML = "";
                    Client.$playerSelectionArea.style.display = "none";
                    Client.$playerActionsArea.style.display = "flex";
                }
                button_div.appendChild(cancel_btn);
            }

            var ok_btn = document.createElement("button");
            ok_btn.innerHTML = "Go";
            ok_btn.onclick = function (event) {
                event.preventDefault();
                Client.$playerSelectionArea.style.display = "none";
                Client.$playerActionsArea.style.display = "flex";
                var selection = null;
                if (checkboxes) {
                    selection = [];
                    var inputs = document.getElementsByClassName("input_form_choice");
                    for (const i of inputs)
                        if (i.checked)
                            selection.push(i.value)
                } else {
                    selection = document.querySelector('input[name="choice"]:checked').value;
                }
                Client.$playerSelectionArea.innerHTML = "";
                if (go_callback)
                    go_callback(selection);
            }
            button_div.appendChild(ok_btn);

            Client.$playerSelectionArea.appendChild(form);
            Client.$playerSelectionArea.style.display = "flex";
            Client.$playerActionsArea.style.display = "none";
            Client.$playerSelectionArea.scrollTop = 0;

            if (checkboxes) {
                ok_btn.disabled = true;
                var inputs = document.getElementsByClassName("input_form_choice");
                for (var i = 0; i < inputs.length; i++) {
                    inputs[i].onclick = checkFunc;
                }
                function checkFunc() {
                    var count = 0;
                    for (var i = 0; i < inputs.length; i++) {
                        if (inputs[i].checked === true) {
                            count++;
                        }
                    }
                    if (count >= n_choices) {
                        for (i = 0; i < inputs.length; i++) {
                            if (inputs[i].checked === false) {
                                inputs[i].disabled = true;
                            }
                        }
                        ok_btn.disabled = false;
                    } else {
                        for (i = 0; i < inputs.length; i++) {
                            if (inputs[i].checked === false) {
                                inputs[i].disabled = false;
                            }
                        }
                        ok_btn.disabled = true;
                    }
                }
            } else {
                ok_btn.disabled = true;
                var inputs = document.getElementsByClassName("input_form_choice");
                for (var i = 0; i < inputs.length; i++) {
                    inputs[i].onclick = checkFunc;
                }
                function checkFunc() {
                    ok_btn.disabled = false;
                }
            }

        },

        cure: function () {
            var possible_colours = Object.keys(Client.actions_data.curable_colours);

            if (possible_colours.length == 1) {
                Client._cure_single_disease(possible_colours[0])
            } else {
                Client._ask_question(
                    possible_colours,
                    (colour) => Client._cure_single_disease(colour),
                    1,
                    null,
                    true,
                    "Choose which disease to cure",
                    false
                )
            }

        },

        _cure_single_disease: function (colour) {
            function reply_func(cards) { IO.socket.emit("player_cure", cards); };
            var n_discard = Client.actions_data.n_cards_to_cure;
            var possible_cards = Client.actions_data.curable_colours[colour];
            if (possible_cards.length == n_discard) {
                reply_func(possible_cards)
            } else {
                Client._ask_question(
                    possible_cards,
                    (cards) => { reply_func(cards) },
                    Client.actions_data.n_cards_to_cure,
                    null,
                    true,
                    "Select the " + n_discard + " cards to cure",
                    true
                )
            }
        },

        share_knowledge: function(){
            Client._shareKnowledgeOtherPlayerQuestion();
        },

        _shareKnowledgeOtherPlayerQuestion: function(){
            var possible_players = array_from_objects_list(Client.actions_data.share_knowledge_data, "other_player");
            possible_players = [...new Set(possible_players)]; // remove possible duplicates
            function next_step(player){ Client._shareKnowledgeGiveOrTake(player); }
            if (possible_players.length > 1){
                Client._ask_question(
                    possible_players,
                    (player) => next_step(player),
                    1,
                    null,
                    true,
                    "Chose a player to trade with"
                )
            } else {
                next_step(possible_players[0])
            }
        },

        _shareKnowledgeGiveOrTake: function(player){
            var possible_trades = Client.actions_data.share_knowledge_data.filter(
                (t) => {return t.other_player == player;}
            )
            var possible_directions = array_from_objects_list(possible_trades, "direction");
            possible_directions = [...new Set(possible_directions)];
            function next_step(direction){ Client._shareKnowledgeCard(possible_trades, direction); }
            if (possible_directions.length > 1){
                Client._ask_question(
                    possible_directions,
                    (direction) => next_step(direction),
                    1,
                    null,
                    true,
                    "Which direction to trade?"
                )
            } else {
                next_step(possible_directions[0]);
            }
        },

        _shareKnowledgeCard: function(trades, direction){
            var possible_trades = trades.filter(
                (t) => {return t.direction == direction;}
            )
            var possible_cards = array_from_objects_list(possible_trades, "card");
            function next_step(card){ Client._submitShareKnowledgeProposal(possible_trades, card); }
            if (possible_cards.length > 1){
                Client._ask_question(
                    possible_cards,
                    (card) => next_step(card),
                    1,
                    null,
                    true,
                    "Which card to " + direction.toLowerCase() + "?"
                )
            } else {
                next_step(possible_cards[0]);
            }
        },

        _submitShareKnowledgeProposal: function(trades, card){
            for (const t of trades){
                if (t.card == card){
                    IO.socket.emit("shareKnowledgeProposal", t)
                    break;
                }
            }
        },

        incoming_shareKnowledgeProposal(data){
            console.log("incoming proposal")
            function reply_func(answer){
                IO.socket.emit("shareKnowledgeResponse", {answer: answer, trade_data: data.trade_data, current_player: data.trade_player})
            }
            var is_give = data.trade_data.direct_flight == "Take"; // direction reversed for this player
            var heading = is_give ? "Give " : "Receive ";
            heading += data.trade_data.card;
            heading += is_give ? " to " : " from ";
            heading += data.trade_player;
            Client._ask_question(
                ["Yes", "No"],
                (answer) => reply_func(answer),
                1,
                null,
                false,
                heading
            )
        },

        gameOver: function(data){
            var blockingDiv = document.getElementById("blockingDiv")
            blockingDiv.style.opacity = 0.7;

            var gameOverDiv = document.getElementById("gameOverDiv");
            gameOverDiv.style.display ="block";

            var gameOverMessage = document.getElementById("game-over-message");
            gameOverMessage.textContent = data.message;
        }


    }

    IO.init();
    Client.init();

}($));
