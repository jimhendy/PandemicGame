
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
            /*
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

            
            IO.socket.on("updateInfectionCounter", Client.updateInfectionCounter);

            IO.socket.on("discardInfectionCard", Client.discardInfectionCard);
            IO.socket.on("drawInfectionCards", Client.drawInfectionCards);
            IO.socket.on("newPlayerCards", Client.receivePlayerCards);
            IO.socket.on("newPlayersTurn", Client.newPlayerTurn);
            IO.socket.on("discardPlayerCardFromHand", Client.remove_player_card_from_hand);
            IO.socket.on("discardPlayerCards", Client.discardPlayerCards);

            IO.socket.on("epidemicDraw", Client.epidemicDraw);

            IO.socket.on("enableActions", Client.enableActions);

            IO.socket.on("changeLocation", Client.changeLocation);
            IO.socket.on("updatePlayerTurns", Client.updatePlayerTurns);

            IO.socket.on("addPlayerCardToHand", Client.addPlayerCardToHand)
            IO.socket.on("refreshPlayerHand", Client.refreshPlayerHand)

            IO.socket.on("gameOver", Client.gameOver);
            */
            IO.socket.on("clientAction", Client.actionDirector);

            IO.socket.on("parallel_actions", Client.parallel_actions);
            IO.socket.on("series_actions", Client.series_actions);

            IO.socket.on("logMessage", Client.logMessage);
        },

        onConnected: function () {
            Client.data.socket_id = IO.socket.id;
        },

        error: function (data) {
            alert(data.message);
        },

        actionComplete: function () {
            IO.socket.emit("action_complete")
        }

    };

    var Client = {
        data: {
            socket_id: null,
            role: null,
            passcode: null,
            player_name: null,
            current_page: null,
            player_cards: {},
            loaction: null
        },
        images: {},
        question_order: ["action", "player_name", "destination", "disease_colour", "share_direction", "discard_card_name", "response"],

        init: function () {
            Client.cacheElements();
            Client.showLandingScreen();
            Client.bindEvents();
        },


        // =================================================== Action Directors 
        // ALL Client functions should accept an object (dictionary) 
        // data = {function: "function_name", args: [{...}], return: false/true}

        actionDirector: async function (data) {
            // Expects a single function-args combo
            var ret_value = await Client[data.function](data.args)
            if (data.return) {
                console.log("Returning from actionDirector");
                console.log(data);
                IO.actionComplete();
            }
            return ret_value;
        },


        parallel_actions: function (data) {
            // data should be an array of function-args combos
            console.log(data);
            var promises = [];
            for (const a of data.parallel_actions_args) {
                promises.push(Client.actionDirector(a))
            }
            return Promise.all(promises).then(
                () => {
                    if (data.return) {
                        console.log("parallel actions complete")
                        console.log(data)
                        IO.actionComplete()
                    }
                }
            );
        },

        series_actions: async function (data) {
            // data should be an array of function-args combos
            console.log(data)
            for (const a of data.series_actions_args) {
                await Client.actionDirector(a);
            }
            if (data.return) {
                console.log("series action complete")
                console.log(data)
                IO.actionComplete();
            }
        },

        // ====================================================================

        cacheElements: function () {
            Client.$doc = $(document);

            // Templates
            Client.$gameArea = $('#gameArea');
            Client.$landingScreen = $('#landing-screen-template').html();
            Client.$roleChoiceScreen = $('#role-choice-screen-template').html();
            Client.$waitingForRolesTemplate = $('#waiting-for-role-choices-template').html();
            Client.$gameBoardTemplate = $('#game-board-template').html()
        },

        // ============================================ Landing screen

        showLandingScreen: function () {
            Client.$gameArea.html(Client.$landingScreen);
            Client.data.current_page = "landing";
        },

        // ============================================  Role choice screen

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

        // =================================================    Playing the game

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
            Client.$playerLocation = document.getElementById("player_location")
        },

        // =============================================   Image utils

        createImage: async function (data) {
            Client._addCtxAndCanvas(data);
            //if (Object.keys(Client.images).includes(data.img_name))
            //    console.log("Image name already exists: " + data.img_name)
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
            alter_image(
                Client.images[data.img_name],
                data.new_image_file
            )
        },

        removeImage: function (img_name) {
            var img = Client.images[img_name];
            clearImage(img).then(
                () => { delete Client.images[img_name] }
            );
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

        // =============================================

        updateInfectionCounter: function (text) {
            Client.$infectionCounterLog.html(text)
        },

        /*
        receivePlayerCards: async function (cards) {
            for (let c of cards) {
                await Client.receivePlayerCard(c);
            }
            //IO.socket.emit("playerCardsReceived");
            IO.actionComplete();
        },
        /*
        /*
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
            if (card_data.is_epidemic) {
                return new Promise((resolve) => {
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
        */
        /*
        discardPlayerCards: async function (cards) {
            for (let c of cards) {
                await Client.discardPlayerCard(c);
            }
            //IO.socket.emit("playerCardDiscarded");
            IO.actionComplete();
        },

        discardPlayerCard: function (card_data) {
            return new Promise((resolve, reject) => {
                Client.createImage(card_data);
                Client.moveImage(card_data).then(() => { resolve(); });
            })
        },
        */
        addPlayerCardToHand: function (data) {

            var n_previous = Object.keys(Client.data.player_cards).length;
            var y_offset = 10 * n_previous
            var x_offset = 5 * (n_previous + 1);

            Client.data.player_cards[data.card_name] = data;

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
        /*
        discardInfectionCard: function (data) {
            if (Object.keys(Client.images).includes(data.img_name)) {
                Client.removeImage(data.img_name)
            }
            Client.createImage(data).then(
                () => IO.actionComplete()
            )
        },
        */
        /*
        newPlayerTurn: function (player_name) {
            Client.$currentPlayerDiv.textContent = player_name
            if (player_name != Client.data.player_name)
                return;
            IO.socket.emit("enquireAvailableActions", Client.data);
        },
        */
        enableActions: function (data) {
            Client.action_data = data;
            Client.present_actions(Client.action_data)
        },

        present_actions: function (remaining_actions, level = 0, answers = null) {

            if (level > 20) {
                IO.error({ message: "Something has gone wrong" })
                console.error(remaining_actions)
                return
            }

            if (remaining_actions.length == 1) {
                // Single choice left, use it
                var response_data = remaining_actions[0];
                response_data.answers = answers;
                IO.socket.emit("action_response", response_data)
                return;
            }

            answers = answers == null ? {} : answers;
            var question = Client.question_order[level];

            if (Object.keys(remaining_actions[0]).includes(question)) {
                Client._ask_question(
                    array_from_objects_list(remaining_actions, question, true),
                    (answer) => {
                        var new_remaining_actions = remaining_actions.filter(
                            (a) => { return a[question] == answer; }
                        );
                        // We may have chosen multiple options which do not correspond to a single option in the array
                        // If this is the case, chose a single option from the available ones to maintain metadata in the options object
                        if (!new_remaining_actions.length) {
                            new_remaining_actions = [remaining_actions[0]];
                            // We remove the false data that was not chosen
                            delete new_remaining_actions[0][question];
                        }
                        answers[question] = answer;
                        Client.present_actions(new_remaining_actions, level + 1, answers);
                    },
                    remaining_actions[0][question + "__n_choices"] || 1,
                    array_from_objects_list(remaining_actions, question + "__colour") || null,
                    level > 0 && remaining_actions[0][question + "__cancel_button"],
                    remaining_actions[0][question + "__title"] || null,
                    remaining_actions[0][question + "__checkboxes"] || false,
                )
            } else {
                Client.present_actions(remaining_actions, level + 1, answers)
            }
        },

        remove_player_card_from_hand: function (card_name) {
            delete Client.data.player_cards[card_name];
            Client.refreshPlayerHand();
        },

        changeLocation: function (city_name) {
            Client.data.city_name = city_name;
            Client.$playerLocation.textContent = city_name;
        },

        updatePlayerTurns: function (data) {
            Client.$currentPlayerDiv.textContent = data.player + " (" + parseInt(data.used_actions + 1) + "/" + data.total_actions + ")"
        },
        /*
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
        
        infection_deck_draw: function (data) {

        },

        
        epidemicDraw: async function (data) {
            for (var i = 0; i < data.cards.length; i++) {
                Client.createImage(data.cards[i]);
                await Client.moveImage(data.cards[i]).then(() => {
                    Client.removeImage("infection_discard")
                });
            }
        },
        */
        _ask_question: function (
            options,
            go_callback = null,
            n_choices = 1,
            colours = null,
            cancel_button = true,
            title = null,
            checkboxes = false
        ) {

            if (options.length == 1 && n_choices == 1) {
                go_callback(options[0])
                return;
            } else if (options.length == n_choices) {
                go_callback(options)
                return;
            }

            var form = document.createElement("form");
            form.style.width = "100%"
            var input_type = checkboxes ? "checkbox" : "radio";

            if (title) {
                var heading = document.createElement("h3");
                heading.textContent = title;
                heading.style.marginTop = "1%";
                heading.style.marginBottom = "1%";
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
            button_div.style.marginTop = "2%"
            form.appendChild(button_div)

            if (cancel_button) {
                var cancel_btn = document.createElement("button");
                cancel_btn.innerHTML = "Cancel";
                cancel_btn.onclick = function (event) {
                    event.preventDefault();
                    Client._hide_selections();
                    Client.present_actions(Client.action_data);
                }
                button_div.appendChild(cancel_btn);
            }

            var ok_btn = document.createElement("button");
            ok_btn.innerHTML = "Go";
            ok_btn.onclick = function (event) {
                event.preventDefault();
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
                Client._hide_selections();
                if (go_callback)
                    go_callback(selection);
            }
            button_div.appendChild(ok_btn);

            Client.$playerSelectionArea.appendChild(form);
            Client._show_selections();

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

        _show_selections: function () {
            //Client.$playerSelectionArea.style.display = "block";
            Client.$playerSelectionArea.style.height = "20%";
            Client.$gameLog.style.height = "calc(15% - 4px)";
            Client.$playerSelectionArea.scrollTop = 0;
        },

        _hide_selections: function () {
            Client.$playerSelectionArea.innerHTML = "";
            Client.$playerSelectionArea.style.height = "0%";
            //Client.$playerSelectionArea.style.display = "none";
            Client.$gameLog.style.height = "calc(35% - 4px)"
        },


        gameOver: function (data) {
            var blockingDiv = document.getElementById("blockingDiv")
            blockingDiv.style.opacity = 0.7;

            var gameOverDiv = document.getElementById("gameOverDiv");
            gameOverDiv.style.display = "block";

            var gameOverMessage = document.getElementById("game-over-message");
            gameOverMessage.textContent = data.message;
        }


    }

    IO.init();
    Client.init();

}($));
