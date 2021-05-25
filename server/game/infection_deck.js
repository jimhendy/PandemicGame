const utils = require("./utils")

class InfectionDeck {
    constructor(io, game_id, queue, cities, players, diseases) {

        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.cities = cities;
        this.diseases = diseases;
        this.players = players;

        this.deck = Object.keys(this.cities);
        utils.shuffle(this.deck);

        this.discarded = [];

        this.card_width_frac = 0.142;
        this.card_height_frac = 0.14;

        this.deck_location = [0.597, 0.058];
        this.discard_location = [0.759, 0.058];

        this._create_deck_image();

        // Bind events
        this._create_deck_image = this._create_deck_image.bind(this);
        this._remove_deck_image = this._remove_deck_image.bind(this);
        this._infection_deck_image_data = this._infection_deck_image_data.bind(this);
        this.initial_deal = this.initial_deal.bind(this);
        this._discard_card_data = this._discard_card_data.bind(this);
        this._infect_city = this._infect_city.bind(this);
        this.draw = this.draw.bind(this);
        this.epidemic_intensify = this.epidemic_intensify.bind(this);
        this._get_protected_cities = this._get_protected_cities.bind(this);
        this._remove_discarded_image = this._remove_discarded_image.bind(this);
        this.remove_discarded_card = this.remove_discarded_card.bind(this);
        this.reorder_deck = this.reorder_deck.bind(this);

    }

    _create_deck_image() {
        this.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction", { function: "createImage", args: this._infection_deck_image_data(), return: true }
            ),
            null, "all", "Creating infection deck image"
        )
    }

    _remove_deck_image() {
        this.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction", { function: "removeImage", args: this._infection_deck_image_data().img_name, return: true }
            ),
            null, "all", "Removing infection deck image"
        )
    }

    _remove_discarded_image() {
        this.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction", { function: "removeImage", args: "infection_discard", return: true }
            ),
            null, "all", "Removing infection deck discard image"
        )
    }

    _infection_deck_image_data() {
        return {
            img_type: "card",
            img_name: "infection_deck",
            image_file: "images/game/infection_deck/Back Infection.gif",
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
            cardCanvas: true
        }
    }

    initial_deal(update_infection_count_callback) {
        for (var cubes = 3; cubes >= 1; cubes--) {
            for (var c = 0; c < 3; c++) {
                this._infect_city(this.deck.pop(), cubes);
                update_infection_count_callback();
            }
        }
    }

    _infect_city(city_name, cubes, ignore_cities=null, log_message = null) {
        var city = this.cities[city_name];
        var card_data = this._discard_card_data(city);
        var final_card_data = Object.assign({ ...card_data }, { cardCanvas: true, animationCanvas: false })
        final_card_data.x = final_card_data.dest_x;
        final_card_data.y = final_card_data.dest_y;
        // Rename the animation image
        card_data.img_name += "_temp";
        // Sort the message
        if (log_message == null) {
            log_message = {
                message: "&#9760; " + city.city_name + " was infected with " + cubes + (cubes == 1 ? " cube" : " cubes"),
                style: { color: city.native_disease_colour }
            }
        }
        // Move the infection card from the deck
        this.queue.add_task(
            () => this.io.to(this.game_id).emit(
                "parallel_actions",
                {
                    parallel_actions_args: [
                        {
                            function: "series_actions",
                            args: {
                                series_actions_args: [
                                    { function: "createImage", args: card_data },
                                    { function: "moveImage", args: card_data },
                                    { function: "createImage", args: final_card_data },
                                    { function: "removeImage", args: card_data.img_name }
                                ]
                            }
                        },
                        {
                            function: "logMessage",
                            args: log_message
                        }
                    ],
                    return: true
                }
            ), null, "all", "Discarding " + city.city_name + " infection deck card"
        )
        // Add the cubes to the city
        for (var n = 0; n < cubes; n++) {
            this.queue.add_task(city.add_cube, [this.cities, null, ignore_cities], 0, "Adding cubes to " + city_name);
        }
        // Move this card into the discard pile in this code
        this.discarded.push(city_name);
    }

    _discard_card_data(city) {
        return {
            img_type: "card",
            img_name: "infection_discard",
            image_file: "images/game/infection_deck/Infection " + utils.toTitleCase(city.native_disease_colour) + " " + utils.toTitleCase(city.city_name) + ".jpg",
            x: this.deck_location[0],
            y: this.deck_location[1],
            dx: this.card_width_frac,
            dy: this.card_height_frac,
            dest_x: this.discard_location[0],
            dest_y: this.discard_location[1],
            dt: 1,
            animationCanvas: true
        }
    }

    async draw(epidemic_draw = false) {
        return new Promise(
            resolve => {
                if (!this.deck.length) {
                    this.deck = this.discarded;
                    this.discarded = [];
                    utils.shuffle(this.deck);
                    this._create_deck_image();
                    this._remove_discarded_image();
                }

                if (epidemic_draw)
                    var city_name = this.deck.shift(); // "pop" from the front
                else
                    var city_name = this.deck.pop();
                var colour = this.cities[city_name].native_disease_colour;
                var n_cubes = epidemic_draw ? 3 : 1;
                var log_message = null;
                var ignore_cities = this._get_protected_cities(colour);

                if (this.diseases[colour].eradicated) {
                    log_message = { message: city_name + " was NOT infected as disease is eradicated", style: { color: colour } };
                    n_cubes = 0;
                } else if (ignore_cities.includes(city_name)) {
                    log_message = { message: city_name + " was NOT infected as it is protected", style: { color: colour } };
                    n_cubes = 0;
                }

                this._infect_city(city_name, n_cubes, ignore_cities, log_message);

                if (!this.deck.length) {
                    this._remove_deck_image();
                }
                resolve();
            }
        )
    }

    _get_protected_cities(colour) {
        var cities = [];
        var qs = this.players.filter(
            (p) => { return p.role_name == "Quarantine Specialist"; }
        )
        var medic = this.players.filter(
            (p) => { return p.role_name == "Medic"; }
        )
        if (qs.length) {
            qs = qs[0];
            cities.push(qs.city_name);
            for (const c of this.cities[qs.city_name].adjacent_city_names)
                cities.push(c)
        }
        if (medic.length) {
            medic = medic[0];
            if (this.diseases[colour].cured)
                cities.push(medic.city_name)
        }
        return cities;
    }

    epidemic_intensify() {
        if (this.discarded.length){
            this._remove_discarded_image();
        }
        utils.shuffle(this.discarded);
        var discard_size = this.discarded.length;
        for (var i = 0; i < discard_size; i++) {
            this.deck.push(this.discarded.pop())
        }
        this._create_deck_image();
    }

    remove_discarded_card(card_name) {
        var discard_position = this.discarded.indexOf(card_name);
        
        // Remove the card_data
        this.discarded = this.discarded.filter((c) => { return c != card_name });
        
        if (this.discarded.length == 0) {
            this._remove_discarded_image();
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
                        { function: "logMessage", args: {message: card_name + " infection card is removed from the game."}},
                        { function: "createImage", args: cd },
                        { function: "moveImage", args: cd },
                        { function: "removeImage", args: cd.img_name }
                    ],
                    return: true
                }
            ), card_data, "all", "Removing " + card_name + " infection card from the game"
        )
    }

    reorder_deck(cards){
        for (var i = 0; i<cards.length; i++)
            this.deck.pop();
        for (var i = cards.length - 1; i>=0; i--)
            this.deck.push(cards[i])
    }

}

module.exports = InfectionDeck