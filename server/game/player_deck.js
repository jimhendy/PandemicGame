const city = require("./city");
const utils = require("./utils");

class PlayerDeck {
    constructor(io, game_id, queue, cities, n_epidemics = 4) {
        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

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

        for (const ev of this.event_card_names) {
            this.deck.push(
                new PlayerCard(null, false, null, ev)
            )
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

    }

    initial_deal(players, n_initial_cards) {
        for (const p of players) {
            this.drawPlayerCards(n_initial_cards, p);
        }
        //this._add_epidemics();
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
            this.cards_in_player_hands[card.card_name] = card;
            console.log("========================================********************************  " + card.card_name)
            this._give_player_card(player, card)
        }
    }

    _give_player_card(player, card) {
        var card_data = this.emit_data(card);
        player.add_player_card(card_data);
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
        } else {
            // Not an epidemic card
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
                                        { function: "addPlayerCardToHand", args: card_data},
                                        { function: "refreshPlayerHand"},
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
        console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
        console.log(card_names)
        for (const card_name of card_names){
            this.queue.add_task(
                (cn) => {
                    var card = this.cards_in_player_hands[cn];

                    player.discard_card(cn);
                    delete this.cards_in_player_hands[cn];
                    this.discard_pile.push(card);

                    var final_card_data = Object.assign(
                        this.emit_data(card), {x: this.discard_location[0], y: this.discard_location[1]}
                    )
                    var initial_card_data = Object.assign({...final_card_data},
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
                            animationCanvas: true
                        }
                    )
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
                                        { function: "refreshPlayerHand"},
                                        { function: "createImage", args: card_data_player },
                                        { function: "moveImage", args: card_data_player },
                                        { function: "removeImage", args: card_data_player.img_name }, // Remove from animation canvas
                                        { function: "createImage", args: final_card_data}
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
                                            { function: "removeImage", args: card_data_others.img_name }, // Remove from animation canvas
                                            { function: "createImage", args: final_card_data}
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