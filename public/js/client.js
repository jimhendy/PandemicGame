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
        question_order: ["action", "player_name", "destination", "disease_colour", "share_direction", "discard_card_name", "response", "infection_deck_card_name", "pick_up_card_name"],
        default_titles: {
            "action": "Pick an action",
            "player_name": "Pick a player",
            "destination": "Pick a destination",
            "disease_colour": "Pick a disease",
            "share_direction": "Pick a trade direction",
            "discard_card_name": "Pick a card to discard"
        },
        action_tooltips: {
            "Drive/Ferry": "Move to a city connected by a white line to the one you are in.",
            "Direct Flight": "Discard a City card to move to the city named on the card.",
            "Charter Flight": "Discard the City card that matches the city you are in to move to any city.",
            "Shuttle Flight": "Move from a city with a research station to any other city that has a research station.",
            "Build Research Station": "Discard the City card that matches the city you are in to place a research station there.<br><br>If all 6 research stations have been built, take a research station from anywhere on the board.",
            "Treat Disease": "Remove 1 disease cube from the city you are in.<br>If this disease color has been cured, remove all cubes of that color from the city you are in.<br><br>If the last cube of a cured disease is removed from the board, this disease is eradicated.",
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
            "Forecast": "Draw, look at, and rearrange the top 6 cards of the infetion deck.<br>Put them back on top.",
            "Government Grant": "Add 1 research station to any city (no discard needed).",
            "One Quiet Night": "Skip the next infect cities step (do not flip over any infection cards).",
            "Resilient Population": "Remove any 1 card in the infection discard pile from the game.<br>You may play this between the infect and intensify stages of an epidemic."
        },
        text_colours: {
            "yellow": "yellow",
            "blue": "#5257ff", //"blue",
            "red": "red",
            "black": "black"
        },

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
                //console.log("Returning from actionDirector");
                //console.log(data);
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
                        //console.log("parallel actions complete")
                        //console.log(data)
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
                //console.log("series action complete")
                //console.log(data)
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
                return;
            }

            var roles_list = document.createElement("div");
            roles_list.setAttribute("id", "roles_list")
            roles_list.style.display = "flex"

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

                var role_div = document.createElement("div")
                role_div.setAttribute("class", "role-card-container has-tooltip")

                var role_img = document.createElement("img")
                role_img.setAttribute("class", card_class)
                role_img.setAttribute("data-role", role)
                role_img.setAttribute("src", "/images/game/roles/Role - " + role + ".jpg")

                var role_player_name_div = document.createElement("div")
                role_player_name_div.setAttribute("class", "centered role-player-name")
                role_player_name_div.textContent = role_name;

                var wrapper_span = document.createElement("span")
                wrapper_span.setAttribute("class", "tooltip-wrapper")
                var tooltip_span = document.createElement("span")
                tooltip_span.setAttribute("class", "tooltip")
                tooltip_span.style.width = "calc(100vw / 7 - 1vw)"
                tooltip_span.style.top = "35vh"
                tooltip_span.innerHTML = Client.role_tooltips[role]
                wrapper_span.appendChild(tooltip_span)

                role_div.appendChild(wrapper_span)
                role_div.appendChild(role_img)
                role_div.appendChild(role_player_name_div)

                roles_list.appendChild(role_div)
            }
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
            
            Client.configure_player_role_reminder();
        },

        configure_player_role_reminder: function(){
            var role_reminder_div = document.getElementById('player-role-reminder');

            var wrapper_span = document.createElement("span")
            wrapper_span.setAttribute("class", "tooltip-wrapper")

            var tooltip_span = document.createElement("span")
            tooltip_span.setAttribute("class", "tooltip")
            tooltip_span.style.width = "30vw"
            tooltip_span.style.top = "5vh"
            tooltip_span.style.right = "30vw"
            tooltip_span.innerHTML = Client.role_tooltips[Client.data.role]
            wrapper_span.appendChild(tooltip_span)

            role_reminder_div.appendChild(wrapper_span)
            role_reminder_div.appendChild(document.createTextNode(Client.data.role));
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
            if (img == null) {
                console.error("Asked to remove " + img_name + ", but can't find image")
                for (const i of Object.keys(Client.images))
                    console.error(i);
            }
            return clearImage(img).then(
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

        updatePlayerCardCount: function(data){
            document.getElementById("player_cards_remaining").innerHTML = data;
        },

        updateInfectionCounter: function (data) {
            var text = ""
            var totals = {'yellow': 0, 'red':0, 'blue': 0, 'black': 0}
            for (const ic of data) {
                text += '<p style="margin-top: 0px; margin-bottom: 0px; margin-left: 5px; margin-right: 5px; text-align: left; '
                text += ' font-weight: ' + (ic.num == 3 ? 'bold': 'null') + "; ";
                text += ' color: ' + Client.text_colours[ic.colour] + '; ">' + ic.city_name
                text += '<span style="float:right;">' + ic.num + '</span></p>'
                totals[ic.colour] += ic.num;
            }
            Client.$infectionCounterLog.html(text)
            for (const [k,v] of Object.entries(totals)){
                document.getElementById(k + '_cubes_counter').innerHTML = v+'/24'
            }
        },

        addPlayerCardToHand: function (data) {

            var n_previous = Object.keys(Client.data.player_cards).length;
            var y_offset = 10 * n_previous
            var x_offset = 5 * (n_previous + 1);

            Client.data.player_cards[data.card_name] = data;

            var new_img = document.createElement("img");
            new_img.setAttribute("class", "player-hand-card");
            new_img.setAttribute("src", data.image_file);
            new_img.setAttribute("z-index", n_previous);
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
            new_message.innerHTML = data.message;
            if (Object.keys(data).includes("style")) {
                for (const [key, value] of Object.entries(data.style)) {
                    if (key == "color"){
                        new_message.style[key] = Client.text_colours[value]
                    } else {    
                        new_message.style[key] = value;
                    }
                }
            }
            Client.$gameLog.prepend(new_message);
        },

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

            answers = answers == null ? {} : answers;
            var question = Client.question_order[level];

            if (remaining_actions.length == 1 && !remaining_actions[0][question + "__stop_autochoice"]) {
                // Single choice left, use it
                var response_data = remaining_actions[0];
                response_data.answers = answers;
                IO.socket.emit("action_response", response_data)
                return;
            }

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
                    remaining_actions[0][question + "__title"] || Client.default_titles[question] || null,
                    remaining_actions[0][question + "__checkboxes"] || false,
                    remaining_actions[0][question + "__sortable"] || false,
                    remaining_actions[0][question + "__stop_autochoice"] || false
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

        _ask_question: function (
            options,
            go_callback = null,
            n_choices = 1,
            colours = null,
            cancel_button = true,
            title = null,
            checkboxes = false,
            sortable = false,
            stop_autochoice = false
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
                heading.style.marginTop = "1%";
                heading.style.marginBottom = "1%";
                form.appendChild(heading)
            }

            if (sortable) {
                // Sortable list
                var list = document.createElement("ul")
                list.setAttribute("id", "sortable")

                for (var i = 0; i < options.length; i++) {
                    var o = options[i];
                    var colour = colours === null ? null : colours[i];

                    var list_entry = document.createElement("li");
                    list_entry.setAttribute("class", "ui-state-default sortable-choice");
                    list_entry.setAttribute("data-city-name", o);

                    list_entry.textContent = "⬍   " + o;
                    list_entry.style.color = Client.text_colours[colour];

                    list.appendChild(list_entry)
                }

                form.appendChild(list);

            } else {
                // Checkboxes / radios

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
                    label.style.color = Client.text_colours[colour];
                    
                    if (colour && colour.toLowerCase() == "yellow")
                        label.style.backgroundColor = "#bfbfbd"
                    
                    label.textContent = o;
                    label.setAttribute("class", "has-tooltip")

                    var tooltip = null;
                    if (Object.keys(Client.action_tooltips).includes(o)) {
                        tooltip = Client.action_tooltips[o];
                    } else if (Object.keys(Client.event_card_tooltips).includes(o)){
                        tooltip = Client.event_card_tooltips[o];
                    }
                    if (tooltip != null){
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
                $('#player_selection_area').stop()
                var selection = null;
                if (checkboxes) {
                    selection = [];
                    var inputs = document.getElementsByClassName("input_form_choice");
                    for (const i of inputs)
                        if (i.checked)
                            selection.push(i.value)
                } else if (sortable) {
                    selection = [];
                    var inputs = document.getElementsByClassName("sortable-choice");
                    for (const i of inputs) {
                        selection.push(i.getAttribute("data-city-name"))
                    }
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
                        Client._scroll_selection_to_bottom();

                    } else {
                        for (i = 0; i < inputs.length; i++) {
                            if (inputs[i].checked === false) {
                                inputs[i].disabled = false;
                            }
                        }
                        ok_btn.disabled = true;
                    }
                }
            } else if (sortable) {
                ok_btn.disabled = false;
            } else {
                // radios
                ok_btn.disabled = true;
                var inputs = document.getElementsByClassName("input_form_choice");
                for (var i = 0; i < inputs.length; i++) {
                    inputs[i].onclick = checkFunc;
                }
                function checkFunc() {
                    ok_btn.disabled = false;
                    Client._scroll_selection_to_bottom();
                }
            }

        },

        _show_selections: function () {
            //Client.$playerSelectionArea.style.display = "block";
            Client.$playerSelectionArea.style.height = "calc(20vh - 2px)";
            Client.$gameLog.style.height = "calc(15vh - 2px)";
            Client.$playerSelectionArea.scrollTop = 0;

            $(function () {
                $("#sortable").sortable();
                $("#sortable").disableSelection();
            });
        },

        _hide_selections: function () {
            Client.$playerSelectionArea.innerHTML = "";
            Client.$playerSelectionArea.style.height = "0px";
            //Client.$playerSelectionArea.style.display = "none";
            Client.$gameLog.style.height = "calc(35vh - 2px)"
        },

        _scroll_selection_to_bottom: function () {
            $('#player_selection_area').animate(
                { scrollTop: Client.$playerSelectionArea.scrollHeight - Client.$playerSelectionArea.clientHeight },
                { duration: 2000, easing: "easeInOutCubic" }
            );
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
