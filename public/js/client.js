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

            IO.socket.on("discardInfectionCard", Client.discardInfectionCard);
            IO.socket.on("newPlayerCards", Client.receivePlayerCards);
            IO.socket.on("newPlayersTurn", Client.newPlayerTurn);

            IO.socket.on("enableActions", Client.enableActions);
        },

        onConnected: function () {
            Client.data.socketId = IO.socket.id;
        },

        error: function (data) {
            alert(data.message);
        }

    };

    var Client = {
        data: {
            socketId: null,
            role: null,
            passcode: null,
            username: null,
            current_page: null,
            player_cards: []
        },
        images: {},
        button_names: ["drive_ferry", "direct_flight", "charter_flight", "shuttle_flight", "builld_research_station", "treat_disease", "cure", "share_knowledge", "special", "pass"],

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
                roles_list += '<div class="centered role-username">'
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
        },

        waitForOtherRoles: function () {
            Client.$gameArea.html(Client.$waitingForRolesTemplate);
            Client.data.current_page = "waiting_for_roles";
            IO.socket.emit("waiting_for_other_roles");
        },

        playerJoinForm: function (event) {
            event.preventDefault();
            Client.data['passcode'] = $('#passcode_input').val();
            Client.data['username'] = $('#playername_input').val();
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

            Client.$buttons = {};
            for (const b of Client.button_names){
                Client.$buttons[b] = document.getElementById('button_' + b);
            }
        },

        createImage: function (data) {
            Client._addCtxAndCanvas(data);
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
            )
        },

        alterImage: function (data) {
            alter_image(
                Client.images[data.img_name],
                data.new_img_file
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
            Client.$ctxAnimation.clearRect(0, 0, Client.$canvasAnimation.width, Client.$canvasAnimation.height);
            IO.socket.emit("playerCardsReceived");
        },

        receivePlayerCard: function (card_data) {
            var data = {
                img_type: "flying_card",
                img_name: "flying_card_" + card_data.img_name,
                image_file: card_data.img_file,
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
        },

        addPlayerCardToHand: function (data) {

            var y_offset = 10 * Client.data.player_cards.length;
            var x_offset = 5 * (Client.data.player_cards.length + 1);
            Client.data.player_cards.push(data.city_name);

            var new_img = document.createElement("img");
            new_img.setAttribute("class", "player-hand-card");
            new_img.setAttribute("src", data.img_file);
            new_img.setAttribute("z-order", Client.data.player_cards.length);
            new_img.style.top = y_offset + "%";
            new_img.style.left = x_offset + "%";

            Client.$playerHandStore.appendChild(new_img);
        },

        logMessage: function(data){
            var new_message = document.createElement("p");
            new_message.setAttribute("class", "log-message");
            new_message.textContent = data.message;
            if (Object.keys(data).includes("style")){
                for (const [key, value] of Object.entries(data.style)){
                    new_message.style[key] = value;
                }
            }
            Client.$gameLog.prepend(new_message);//, Client.$gameLog.firstChild);
        },

        discardInfectionCard: function (data) {
            if (Object.keys(Client.images).includes(data.img_name)) {
                Client.removeImage(data.img_name)
            }
            Client.createImage(data);
        },

        newPlayerTurn: function(player_name){
            Client.$currentPlayerDiv.textContent = player_name
            if (player_name != Client.data.username)
                return;
            IO.socket.emit("enquireAvailableActions", Client.data);
        },

        enableActions: function(data){
            Client.adjacent_cities = data.adjacent_cities;
            for (const [btn, enable] of Object.entries(data.actions)){
                Client.$buttons[btn].disabled = !enable;
            }
        },

        drive_ferry: function(){
            var form = document.createElement("form");

            for (const c of Client.adjacent_cities){
                var input = document.createElement("input");
                input.setAttribute("type", "radio");
                input.setAttribute("value", c);
                input.setAttribute("name", "choice");
                var label = document.createElement("label");
                label.setAttribute("for", c);
                label.textContent = c;
                var br = document.createElement("br");
                form.appendChild(input);
                form.appendChild(label);
                form.appendChild(br);
            }
            var cancel_btn = document.createElement("button");
            cancel_btn.innerHTML = "Cancel";
            var ok_btn = document.createElement("button");
            ok_btn.innerHTML = "Go";
            
            cancel_btn.onclick = function(event){
                event.preventDefault();
                Client.$playerSelectionArea.innerHTML = "";
                Client.$playerSelectionArea.style.display = "none";
                Client.$playerActionsArea.style.display = "flex";
            }

            ok_btn.onclick = function(event){
                event.preventDefault();
                Client.$playerSelectionArea.style.display = "none";
                Client.$playerActionsArea.style.display = "flex";
                var destination = document.querySelector('input[name="choice"]:checked').value;
                IO.socket.emit(
                    "player_drive_ferry", 
                    {
                        destination: destination,
                        data: Client.data
                    }
                )
                Client.$playerSelectionArea.innerHTML = "";
            }

            form.appendChild(cancel_btn);
            form.appendChild(ok_btn);

            Client.$playerSelectionArea.appendChild(form);
            Client.$playerSelectionArea.style.display = "flex";
            Client.$playerActionsArea.style.display = "none";
        }
    }

    IO.init();
    Client.init();

}($));
