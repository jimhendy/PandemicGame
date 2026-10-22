class City {
    constructor(io, game_id, queue, diseases, markers, name, native_disease_colour, location, adjacent_city_names) {
        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.diseases = diseases;
        this.markers = markers;

        this.city_name = name;
        this.native_disease_colour = native_disease_colour;
        this.location = location;
        this.adjacent_city_names = adjacent_city_names;
        this.adjacent_city_names.sort();
        this.total_cubes = 0;
        this.has_research_station = false;
        this.disease_cubes = {
            "yellow": 0,
            "red": 0,
            "blue": 0,
            "black": 0
        };
        this.cubs_y_offsets = {
            "yellow": -0.01,
            "red": 0,
            "blue": 0.01,
            "black": 0.02
        }
        this.cube_x_offset = -0.009;

        // Bind Events
        this.add_cube = this.add_cube.bind(this);
        this.remove_cube = this.remove_cube.bind(this);
        this._add_cube_image = this._add_cube_image.bind(this);
        this.cube_image_data = this.cube_image_data.bind(this);
        this.check_connections = this.check_connections.bind(this);
        this.add_research_station = this.add_research_station.bind(this);
        this.remove_research_station = this.remove_research_station.bind(this);
    };

    // chain counts the outbreaks set off by one infection, to pick the right gif
    add_cube(cities, colour = null, ignore_cities = null, send_log_message=false, chain=null) {
        // Might be ignoring this city as it has already outbroken
        if (ignore_cities && ignore_cities.includes(this.city_name)){
            if (send_log_message){
                this.queue.add_task(
                    () => this.io.in(this.game_id).emit(
                        "logMessage",
                        {
                            message: this.city_name + " was NOT infected",
                            style: { color: colour}
                        }, 
                    ), null, 0, "Logging infection of " + this.city_name
                )
            }
            return;
        }

        var colour = colour || this.native_disease_colour;
        var currrent_cubes = this.disease_cubes[colour];
        if (currrent_cubes < 3) {
            this.disease_cubes[colour]++;
            this.total_cubes++;
            this.diseases[colour].add_cube();
            this._add_cube_image(this.disease_cubes[colour], colour)
            if (send_log_message){
                this.queue.add_task(
                    () => this.io.in(this.game_id).emit(
                        "logMessage",
                        {
                            message: "&#9760; " + this.city_name + " was infected with 1 cube",
                            style: { color: colour}
                        }, 
                    ), null, 0, "Logging infection of " + this.city_name
                )
            }
        }
        else {
            // Outbreak
            this.queue.add_task(
                () => this.io.in(this.game_id).emit(
                    "logMessage",
                    {
                        message: "Outbreak of " + colour + " disease from " + this.city_name,
                        style: { color: colour, fontWeight: "bold" }
                    }, 
                ), null, 0, "Logging outbreak"
            )
            this.markers.increase_outbreaks();
            chain = chain || { outbreaks: 0 };
            chain.outbreaks++;
            if (chain.outbreaks <= 2) {
                var gif = chain.outbreaks == 1 ? "outbreak" : "chain_reaction";
                this.queue.add_task(
                    () => this.io.in(this.game_id).emit("clientAction", { function: "showGif", args: gif, return: true }),
                    null, "all", "Showing " + gif + " gif"
                )
            }
            if (ignore_cities) {
                ignore_cities.push(this.city_name)
            }
            else {
                var ignore_cities = [this.city_name]
            }
            var adj_city_name;
            var adj_city;
            for (adj_city_name of this.adjacent_city_names) {
                adj_city = cities[adj_city_name];
                adj_city.add_cube(cities, colour, ignore_cities, true, chain);
            }
        }
    };

    cube_image_data(cube_number, colour) {
        return {
            img_type: "cube",
            img_name: "cube_" + this.city_name + "_" + colour + "_" + cube_number,
            image_file: "images/game/cubes/cube_" + colour + ".png",
            x: this.location[0] + this.cube_x_offset * cube_number - 0.005,
            y: this.location[1] + this.cubs_y_offsets[colour],
            dx: 0.01, dy: 0.01,
            blinkCanvas: true,
            respond: false
        }
    }

    _add_cube_image(cube_number, colour) {
        this.io.in(this.game_id).emit(
            "clientAction",
            { function: "createImage", args: this.cube_image_data(cube_number, colour), return: false }
        )
    }

    remove_cube(colour) {
        var img_name = "cube_" + this.city_name + "_" + colour + "_" + this.disease_cubes[colour];
        this.disease_cubes[colour]--;
        this.total_cubes--;
        this.diseases[colour].remove_cube();
        this.queue.add_task(
            () => this.io.in(this.game_id).emit(
                "clientAction", {function: "removeImage", args: img_name, return: true}
            ),
            null, "all", "Removing " + colour + " cube from " + this.city_name
        )
    }


    check_connections(cities) {
        var adj_city_name;
        var adj_city;
        for (adj_city_name of this.adjacent_city_names) {
            adj_city = cities[adj_city_name];
            if (!adj_city.adjacent_city_names.includes(this.city_name)) {
                console.error(this.city_name + " has " + adj_city_name + " as adj but not vice versa")
            }
        }
    }

    add_research_station() {
        this.has_research_station = true;
    }

    remove_research_station(){
        this.has_research_station = false;
    }
}

// [name, native disease colour, location on the board (fractions), adjacent cities]
const city_definitions = [
    ["Atlanta", "blue", [0.188, 0.373], ["Washington", "Chicago", "Miami"]], // Blue
    ["Chicago", "blue", [0.162, 0.302], ["San Francisco", "Montreal", "Atlanta", "Los Angeles", "Mexico City"]],
    ["Essen", "blue", [0.481, 0.235], ["London", "Paris", "Milan", "St. Petersburg"]],
    ["London", "blue", [0.412, 0.251], ["New York", "Madrid", "Paris", "Essen"]],
    ["Madrid", "blue", [0.402, 0.347], ["New York", "London", "Paris", "Algiers", "Sao Paulo"]],
    ["Milan", "blue", [0.51, 0.282], ["Paris", "Essen", "Istanbul"]],
    ["Montreal", "blue", [0.231, 0.298], ["New York", "Washington", "Chicago"]],
    ["New York", "blue", [0.284, 0.31], ["Montreal", "Washington", "London", "Madrid"]],
    ["Paris", "blue", [0.464, 0.3], ["London", "Madrid", "Milan", "Essen", "Algiers"]],
    ["San Francisco", "blue", [0.074, 0.336], ["Chicago", "Tokyo", "Manila", "Los Angeles"]],
    ["St. Petersburg", "blue", [0.558, 0.214], ["Essen", "Moscow", "Istanbul"]],
    ["Washington", "blue", [0.261, 0.368], ["New York", "Montreal", "Miami", "Atlanta"]],
    ["Bogota", "yellow", [0.225, 0.552], ["Miami", "Mexico City", "Lima", "Sao Paulo", "Buenos Aires"]], // Yellow
    ["Buenos Aires", "yellow", [0.283, 0.746], ["Sao Paulo", "Bogota"]],
    ["Kinshasa", "yellow", [0.501, 0.603], ["Lagos", "Khartoum", "Johannesburg"]],
    ["Khartoum", "yellow", [0.545, 0.516], ["Cairo", "Johannesburg", "Lagos", "Kinshasa"]],
    ["Johannesburg", "yellow", [0.538, 0.70], ["Kinshasa", "Khartoum"]],
    ["Lagos", "yellow", [0.457, 0.535], ["Kinshasa", "Khartoum", "Sao Paulo"]],
    ["Lima", "yellow", [0.20, 0.657], ["Mexico City", "Bogota", "Santiago"]],
    ["Los Angeles", "yellow", [0.088, 0.436], ["Sydney", "Mexico City", "San Francisco", "Chicago"]],
    ["Mexico City", "yellow", [0.152, 0.467], ["Los Angeles", "Chicago", "Miami", "Bogota", "Lima"]],
    ["Miami", "yellow", [0.231, 0.454], ["Atlanta", "Washington", "Bogota", "Mexico City"]],
    ["Santiago", "yellow", [0.21, 0.765], ["Lima"]],
    ["Sao Paulo", "yellow", [0.323, 0.673], ["Buenos Aires", "Bogota", "Lagos", "Madrid"]],
    ["Algiers", "black", [0.479, 0.4], ["Madrid", "Paris", "Istanbul", "Cairo"]], // Black
    ["Baghdad", "black", [0.59, 0.387], ["Istanbul", "Cairo", "Riyadh", "Karachi", "Tehran"]],
    ["Cairo", "black", [0.531, 0.419], ["Algiers", "Istanbul", "Baghdad", "Riyadh", "Khartoum"]],
    ["Chennai", "black", [0.716, 0.544], ["Mumbai", "Delhi", "Kolkata", "Bangkok", "Jakarta"]],
    ["Delhi", "black", [0.707, 0.39], ["Tehran", "Karachi", "Mumbai", "Chennai", "Kolkata"]],
    ["Istanbul", "black", [0.54, 0.337], ["Milan", "Algiers", "St. Petersburg", "Moscow", "Baghdad", "Cairo"]],
    ["Karachi", "black", [0.655, 0.418], ["Riyadh", "Baghdad", "Tehran", "Delhi", "Mumbai"]],
    ["Kolkata", "black", [0.755, 0.414], ["Delhi", "Chennai", "Bangkok", "Hong Kong"]],
    ["Moscow", "black", [0.594, 0.281], ["St. Petersburg", "Istanbul", "Tehran"]],
    ["Mumbai", "black", [0.663, 0.491], ["Karachi", "Delhi", "Chennai"]],
    ["Riyadh", "black", [0.599, 0.474], ["Cairo", "Baghdad", "Karachi"]],
    ["Tehran", "black", [0.643, 0.326], ["Moscow", "Baghdad", "Karachi", "Delhi"]],
    ["Bangkok", "red", [0.764, 0.497], ["Kolkata", "Chennai", "Jakarta", "Ho Chi Minh City", "Hong Kong"]], // Red
    ["Beijing", "red", [0.794, 0.304], ["Seoul", "Shanghai"]],
    ["Ho Chi Minh City", "red", [0.807, 0.568], ["Jakarta", "Bangkok", "Hong Kong", "Manila"]],
    ["Hong Kong", "red", [0.804, 0.453], ["Kolkata", "Shanghai", "Taipei", "Manila", "Ho Chi Minh City", "Bangkok"]],
    ["Jakarta", "red", [0.764, 0.628], ["Chennai", "Bangkok", "Ho Chi Minh City", "Sydney"]],
    ["Manila", "red", [0.874, 0.562], ["Taipei", "Ho Chi Minh City", "San Francisco", "Sydney", "Hong Kong"]],
    ["Seoul", "red", [0.856, 0.299], ["Beijing", "Tokyo", "Shanghai"]],
    ["Shanghai", "red", [0.798, 0.371], ["Beijing", "Seoul", "Hong Kong", "Taipei", "Tokyo"]],
    ["Sydney", "red", [0.914, 0.76], ["Jakarta", "Manila", "Los Angeles"]],
    ["Osaka", "red", [0.908, 0.412], ["Tokyo", "Taipei"]],
    ["Taipei", "red", [0.858, 0.44], ["Osaka", "Shanghai", "Hong Kong", "Manila"]],
    ["Tokyo", "red", [0.903, 0.337], ["Seoul", "Shanghai", "Osaka", "San Francisco"]]
];

module.exports = {
    create_cities: function (io, game_id, queue, diseases, markers) {
        var cities = {};
        for (const [name, colour, location, adjacent] of city_definitions) {
            cities[name] = new City(io, game_id, queue, diseases, markers, name, colour, [...location], [...adjacent]);
        }
        return cities;
    },

    city_definitions: city_definitions,
    City: City
}
