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
            current_page: null
        },

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
        },

        waitForOtherRoles: function(){
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

        startGame: function(data){
            Client.$gameArea.html(Client.$gameBoardTemplate);
            Client.data.current_page = "game_board";
            
            Client.$boardCanvas = document.getElementById("boardCanvas");
            Client.$ctx = Client.$boardCanvas.getContext("2d");

            Client.$blinkCanvas = document.getElementById("cubeCanvas");
            Client.$ctxBlink = Client.$blinkCanvas.getContext("2d");
            
            var blink_canvas_i = 0;
            var blink_canvas_interval_id = setInterval(blink_canvas, 50);
            function blink_canvas() {
                var i_mod = blink_canvas_i % 131;
                if (i_mod > 100)
                    Client.$blinkCanvas.style.opacity = Math.abs(i_mod - 115) / 15;
                blink_canvas_i++;
            }
            
        },

        createImage: function(data){
            var ctx = Client.$ctx;
            var canvas = Client.$boardCanvas
            
            if (data.blinkCanvas){
                var ctx = Client.$ctxBlink;
                var canvas = Client.$blinkCanvas
            }
            
            createImage(
                data.image_file,
                ctx, 
                data.x, data.y,
                data.dx, data.dy,
                canvas
            );
        }
    }

    IO.init();
    Client.init();

}($));
