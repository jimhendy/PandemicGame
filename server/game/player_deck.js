const city = require("./city");
const utils = require("./utils");

class PlayerDeck {
    constructor(io, game_id, queue, game, markers, cities, n_epidemics = 4) {
        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.game = game;

        this.markers = markers;
        this.cities = cities;
        this.n_epidemics = n_epidemics;

        this.deck_location = [0.599, 0.73];
        this.discard_location = [0.732, 0.73];

        this.card_width_frac = 0.103;
        this.card_height_frac = 0.205;

        this.event_card_names = ["Airlift", "Forecast", "Government Grant", "One Quiet Night", "Resilient Population"];

        this.discard_pile = [];
        this.cards_in_player_hands = {};
        this.deck = [];
        for (const [city_name, city] of Object.entries(this.cities)) {
            this.deck.push(
                new PlayerCard(city)
            )
        }
        for (var i = 0; i < 1; i++) {
            for (const ev of this.event_card_names) {
                this.deck.push(
                    new PlayerCard(null, false, null, ev)
                )
            }
        }

        utils.shuffle(this.deck);

        this.io.in(this.game_id).emit(
            "clientAction",
            {
                function: "createImage",
                args: {
                    img_type: "card",
                    img_name: "player_deck",
                    image_file: "images/game/player_cards/Back Player Card.gif",
                    x: this.deck_location[0],
                    y: this.deck_location[1],
                    dx: this.card_width_frac,
                    dy: this.card_height_frac,
                    cardCanvas: true
                }
            }
        )

        // Bind Events
        this.initial_deal = this.initial_deal.bind(this);
        this._add_epidemics = this._add_epidemics.bind(this);
        this.drawPlayerCards = this.drawPlayerCards.bind(this);
        this.emit_data = this.emit_data.bind(this);
        this.discard = this.discard.bind(this);
        this._give_player_card = this._give_player_card.bind(this);
        this.transfer_card_between_players = this.transfer_card_between_players.bind(this);
        this.pick_up_discarded_event_card = this.pick_up_discarded_event_card.bind(this);
    }

    initial_deal(players, n_initial_cards) {
        for (const p of players) {
            this.drawPlayerCards(n_initial_cards, p);
        }
        this._add_epidemics();
    };

    _add_epidemics() {
        var sub_decks = [];
        for (var i = 0; i < this.n_epidemics; i++) {
            var new_epidemic = new PlayerCard(null, true, i)
            sub_decks.push([new_epidemic])
        }
        for (var i = 0; i < this.deck.length; i++) {
            sub_decks[i % this.n_epidemics].push(this.deck[i]);
        }
        this.deck = [];
        for (var i = 0; i < this.n_epidemics; i++) {
            utils.shuffle(sub_decks[i]);
            for (const c of sub_decks[i]) {
                this.deck.push(c)
            }
        }
    }


    drawPlayerCards(n_cards, player) {
        for (var i = 0; i < n_cards; i++) {
            var card = this.deck.pop();
            if (!this.deck.length) {
                this.queue.add_task(
                    () => this.io.in(this.game_id).emit(
                        "clientAction", { function: "removeImage", args: "player_deck" }
                    ))
            }
            this.cards_in_player_hands[card.card_name] = card;
            this._give_player_card(player, card)
        }
    }

    _give_player_card(player, card) {
        var card_data = this.emit_data(card);
        Object.assign(card_data,
            {
                dest_x: 0.3,
                dest_y: 0.2,
                dest_dx: 0.3,
                dest_dy: 0.6,
                dt: 0.5,
                animationCanvas: true
            }
        )

        if (card.is_epidemic) {
            // Do epidemic
            var card_data_pause = Object.assign({ ...card_data }, { dt: 1 })
            this.queue.add_task(
                () => this.io.to(this.game_id).emit(
                    "parallel_actions",
                    {
                        parallel_actions_args: [{
                            function: "series_actions",
                            args: {
                                series_actions_args: [
                                    { function: "createImage", args: card_data },
                                    { function: "moveImage", args: card_data },
                                    { function: "moveImage", args: card_data_pause },
                                    { function: "removeImage", args: card_data.img_name }
                                ]
                            }
                        },
                        {
                            function: "logMessage",
                            args: {
                                message: "An Epidemic card was drawn!",
                                fontWeight: "bold"
                            }
                        }],
                        return: true
                    }
                ),
                null, "all", "Dealing epidemic card from player deck"
            )
            this.game.resolve_epidemic();
        } else {
            // Not an epidemic card
            player.add_player_card(card_data);
            var message = {
                function: "logMessage",
                args: {
                    message: "🃟 " + player.player_name + ' received player card "' + card.card_name + '"',
                    style: { color: card.is_city ? card.city.native_disease_colour : null }
                }
            }
            var card_data_dest_player = Object.assign({ ...card_data }, { dest_x: 1.2 });
            var card_data_dest_others = Object.assign({ ...card_data }, { dest_x: -0.4 });
            this.queue.add_task(
                () => {
                    // Receiving player card
                    this.io.to(player.socket_id).emit(
                        "parallel_actions",
                        {
                            parallel_actions_args: [{
                                function: "series_actions",
                                args: {
                                    series_actions_args: [
                                        { function: "createImage", args: card_data },
                                        { function: "moveImage", args: card_data },
                                        { function: "moveImage", args: card_data_dest_player },
                                        { function: "removeImage", args: card_data.img_name },
                                        { function: "addPlayerCardToHand", args: card_data },
                                        { function: "refreshPlayerHand" },
                                    ]
                                }
                            },
                                message],
                            return: true
                        }
                    );
                    // Other players
                    this.io.sockets.sockets.get(player.socket_id).to(this.game_id).emit(
                        "parallel_actions",
                        {
                            parallel_actions_args: [{
                                function: "series_actions",
                                args: {
                                    series_actions_args: [
                                        { function: "createImage", args: card_data },
                                        { function: "moveImage", args: card_data },
                                        { function: "moveImage", args: card_data_dest_others },
                                        { function: "removeImage", args: card_data.img_name }
                                    ]
                                }
                            },
                                message],
                            return: true
                        }
                    );
                },
                // Remaining args for add_task
                null, "all", "Dealing " + card.card_name + " to " + player.player_name
            )
        }
    }

    emit_data(card) {
        var data = card.emit_data()
        data.x = this.deck_location[0]
        data.y = this.deck_location[1]
        data.dx = this.card_width_frac
        data.dy = this.card_height_frac
        return data
    };

    discard(card_names, player) {
        // card_names is an array of the player card names
        for (const card_name of card_names) {
            this.queue.add_task(
                (cn) => {
                    var card = this.cards_in_player_hands[cn];

                    var x = player.discard_card(cn);
                    delete this.cards_in_player_hands[cn];
                    this.discard_pile.push(card);

                    var final_card_data = Object.assign(
                        this.emit_data(card), { x: this.discard_location[0], y: this.discard_location[1] }
                    )
                    var initial_card_data = Object.assign({ ...final_card_data },
                        {
                            x: null, // different starting points for current and other players
                            y: 0,
                            dx: 0.3,
                            dy: 0.6,
                            dest_x: this.discard_location[0],
                            dest_y: this.discard_location[1],
                            dest_dx: this.card_width_frac,
                            dest_dy: this.card_height_frac,
                            dt: 0.5,
                            animationCanvas: true,
                            cardCanvas: false
                        }
                    )
                    // Rename the animation image so we can remove it after drawing the image on the card canvas
                    initial_card_data.img_name += "_temp";
                    var message = {
                        function: "logMessage",
                        args: {
                            message: player.player_name + ' discards player card "' + card.card_name + '"',
                            style: { color: card.is_city ? card.city.native_disease_colour : null }
                        }
                    }
                    var card_data_player = Object.assign({ ...initial_card_data }, { x: 1.01 });
                    var card_data_others = Object.assign({ ...initial_card_data }, { x: -initial_card_data.dx - 0.01 });

                    // Receiving player card
                    this.io.to(player.socket_id).emit(
                        "parallel_actions",
                        {
                            parallel_actions_args: [{
                                function: "series_actions",
                                args: {
                                    series_actions_args: [
                                        { function: "remove_player_card_from_hand", args: cn },
                                        { function: "refreshPlayerHand" },
                                        { function: "createImage", args: card_data_player },
                                        { function: "moveImage", args: card_data_player },
                                        { function: "createImage", args: final_card_data },
                                        { function: "removeImage", args: card_data_player.img_name }, // Remove from animation canvas
                                    ]
                                }
                            },
                                message],
                            return: true
                        }
                    );
                    // Other players
                    this.io.sockets.sockets.get(player.socket_id).to(this.game_id).emit(
                        "parallel_actions",
                        {
                            parallel_actions_args: [{
                                function: "series_actions",
                                args: {
                                    series_actions_args: [
                                        { function: "createImage", args: card_data_others },
                                        { function: "moveImage", args: card_data_others },
                                        { function: "createImage", args: final_card_data },
                                        { function: "removeImage", args: card_data_others.img_name } // Remove from animation canvas
                                    ]
                                }
                            },
                                message],
                            return: true
                        }
                    );
                },
                // Remaining args for add_task
                card_name, "all", "Discarding " + card_name + " from " + player.player_name
            )
        }
    }

    transfer_card_between_players(card_name, take_player, give_player) {
        var card_data = give_player.discard_card(card_name);
        take_player.add_player_card(card_data);

        var card = this.cards_in_player_hands[card_name];
        var card_data = this.emit_data(card);
        Object.assign(card_data,
            {
                y: 0.2,
                dx: 0.3,
                dy: 0.6,
                dt: 0.5,
                animationCanvas: true
            }
        )

        var card_data_dest_take = Object.assign(
            { ...card_data },
            { x: -card_data.dx - 0.01, dest_x: 1.01 }
        );
        var card_data_dest_give = Object.assign(
            { ...card_data },
            { dest_x: card_data_dest_take.x, x: card_data_dest_take.dest_x }
        );

        var message_text = give_player.player_name + " gives " + card_name + " to " + take_player.player_name;

        this.queue.add_task(
            () => {
                // Log to everyone
                this.io.to(this.game_id).emit(
                    "logMessage",
                    {
                        message: message_text,
                        style: { color: card.is_city ? card.city.native_disease_colour : null }
                    }
                );
                // Receiving player card
                this.io.to(take_player.socket_id).emit(
                    "series_actions",
                    {
                        series_actions_args: [
                            { function: "createImage", args: card_data_dest_take },
                            { function: "moveImage", args: card_data_dest_take },
                            { function: "removeImage", args: card_data_dest_take.img_name },
                            { function: "addPlayerCardToHand", args: card_data },
                            { function: "refreshPlayerHand" },
                        ],
                        return: true
                    }
                );
                // Player giving card
                this.io.to(give_player.socket_id).emit(
                    "series_actions",
                    {
                        series_actions_args: [
                            { function: "remove_player_card_from_hand", args: card_name },
                            { function: "refreshPlayerHand" },
                            { function: "createImage", args: card_data_dest_give },
                            { function: "moveImage", args: card_data_dest_give },
                            { function: "removeImage", args: card_data_dest_give.img_name }
                        ],
                        return: true
                    }
                );
            },
            // Remaining args for add_task
            null, 2, message_text
        );
    }

    pick_up_discarded_event_card(data) {
        // Consider the discard pile image
        console.log("unimplemented")
        /*
        var card_name = data.pick_up_card_name;
        var discard_position = this.discard_pile.indexOf(card_name);

        var card_data = null;
        for (const c in this.discard_pile) {
            if (c.card_name == card_name) {
                card_data = c;
            }
        }
        this.discard_pile = this.discard_pile.filter((c) => { return c.card_name != card_name });

        if (this.discard_pile.length == 0) {
            this.queue.add_task(
                () => {
                    this.io.in(this.game_id).emit(
                        "clientAction",
                        {
                            function: "removeImage", args: 
                        }
                    )
                },
                null, "all", "Removing discarded player card image as discard pile is now empty"

            )
        } else if (discard_position == this.discarded.length) {
            // Was previously the most recently discarded image, remove and replace with 2nd most recently discarded
            var top_city_name = this.discarded[this.discarded.length - 1];
            var top_city = this.cities[top_city_name];
            var top_card_data = this._discard_card_data(top_city);
            Object.assign(top_card_data, { cardCanvas: true, animationCanvas: false })
            top_card_data.x = top_card_data.dest_x;
            top_card_data.y = top_card_data.dest_y;
            this.queue.add_task(
                () => {
                    this.io.to(this.game_id).emit(
                        "series_actions",
                        {
                            series_actions_args: [
                                { function: "removeImage", args: "infection_discard" },
                                { function: "createImage", args: top_card_data }
                            ],
                            return: true
                        },
                    );
                },
                null, "all", "Moving " + top_city_name + " to the top of the infection discard deck"
            )
        }

        var city = this.cities[card_name];
        var card_data = this._discard_card_data(city);
        card_data.img_name += "_temp";
        card_data.x = card_data.dest_x;
        card_data.y = card_data.dest_y;
        card_data.dest_y = - card_data.dy - 0.01

        this.queue.add_task(
            (cd) => this.io.to(this.game_id).emit(
                "series_actions",
                {
                    series_actions_args: [
                        { function: "logMessage", args: { message: card_name + " infection card is removed from the game." } },
                        { function: "createImage", args: cd },
                        { function: "moveImage", args: cd },
                        { function: "removeImage", args: cd.img_name }
                    ],
                    return: true
                }
            ), card_data, "all", "Removing " + card_name + " infection card from the game"
        )


        return card_data;
        */
    }
}

class PlayerCard {
    constructor(city = null, epidemic = false, epidemic_num = null, event_name = null) {
        this.city = city;

        this.is_city = city != null;
        this.is_event = event_name != null;
        this.is_epidemic = epidemic;

        if (this.is_epidemic) {
            this.img_name = "player_card_epidemic_" + epidemic_num
            this.image_file = "images/game/player_cards/Epidemic.jpg"
            this.card_name = "Epidemic";
        } else if (this.is_event) {
            this.card_name = event_name;
            this.img_name = "player_card_event_" + this.card_name;
            this.image_file = "images/game/player_cards/Special Event - " + this.card_name + ".jpg"
        } else if (this.is_city) {
            this.img_name = "player_card_" + this.city.city_name
            this.image_file = "images/game/player_cards/Card " + utils.toTitleCase(this.city.native_disease_colour) + " " + utils.toTitleCase(this.city.city_name) + ".jpg"
            this.card_name = this.city.city_name;
        }

        // Bind Events
        this.emit_data = this.emit_data.bind(this);
    }

    emit_data() {
        return {
            is_epidemic: this.is_epidemic,
            is_city: this.is_city,
            is_event: this.is_event,

            city_name: this.is_city ? this.city.city_name : null,
            img_name: this.img_name,
            card_name: this.card_name,

            image_file: this.image_file,

            cardCanvas: true
        }
    }
}

module.exports = PlayerDeck