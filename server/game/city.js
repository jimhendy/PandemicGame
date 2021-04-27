class City {
    constructor(io, game_id, name, native_disease_colour, location, adjacent_cities) {
        this.io = io;
        this.game_id = game_id;

        this.name = name;
        this.native_disease_colour = native_disease_colour;
        this.location = location;
        this.adjacent_cities = adjacent_cities;
        this.adjacent_cities.sort();
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
    };

    add_cube(cities, colour = null, ignore_cities = null) {
        // Return number of outbreaks occuring due to this new cube

        // Might be ignoring this city as it has already outbroken
        if (ignore_cities && ignore_cities.includes(this.name))
            return 0;

        var n_outbreaks = 0;
        var colour = colour || this.native_disease_colour;
        var currrent_cubes = this.disease_cubes[colour];
        if (currrent_cubes < 3) {
            this.disease_cubes[colour]++;
            this.total_cubes++;
            this.add_cube_image(this.disease_cubes[colour], colour)
        }
        else {
            // Outbreak
            this.io.in(this.game_id).emit(
                "logMessage",
                {
                    message: "Outbreak of " + colour + " disease from " + this.name,
                    style: {
                        color: colour
                    }
                }
            )
            if (ignore_cities) {
                ignore_cities.push(this.name)
            }
            else {
                var ignore_cities = [this.name]
            }
            n_outbreaks++;
            var adj_city_name;
            var adj_city;
            for (adj_city_name of this.adjacent_cities) {
                adj_city = cities[adj_city_name];
                n_outbreaks += adj_city.add_cube(cities, colour, ignore_cities);
            }
        }
        return n_outbreaks;
    };

    add_cube_image(cube_number, colour) {
        var x = this.location[0] + this.cube_x_offset * cube_number - 0.005;
        var y = this.location[1] + this.cubs_y_offsets[colour];
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "cube",
                img_name: "cube_" + this.name + "_" + colour + "_" + cube_number,
                image_file: "images/game/cubes/cube_" + colour + ".png",
                x: x, y: y, dx: 0.01, dy: 0.01,
                blinkCanvas: true
            }
        )
    }

    remove_cube(colour) {
        var img_name = "cube_" + this.name + "_" + colour + "_" + this.disease_cubes[colour];
        this.disease_cubes[colour]--;
        this.total_cubes--;
        this.io.in(this.game_id).emit(
            "removeImage", img_name
        )
    }


    check_connections(cities) {
        var adj_city_name;
        var adj_city;
        for (adj_city_name of this.adjacent_cities) {
            adj_city = cities[adj_city_name];
            if (!adj_city.adjacent_cities.includes(this.name)) {
                console.error(this.name + " has " + adj_city_name + " as adj but not vice versa")
            }
        }
    }

    add_research_station(){
        this.has_research_station = true;
    }
}

module.exports = {
    create_cities: function (io, game_id) {
        city_list = [
            new City(io, game_id, "San Francisco", "blue", [0.074, 0.336], ["Chicago", "Tokyo", "Manila", "Los Angeles"]), // Blue
            new City(io, game_id, "Chicago", "blue", [0.162, 0.302], ["San Francisco", "Toronto", "Atlanta", "Los Angeles", "Mexico City"]),
            new City(io, game_id, "Toronto", "blue", [0.231, 0.298], ["New York", "Washington", "Chicago"]),
            new City(io, game_id, "New York", "blue", [0.284, 0.31], ["Toronto", "Washington", "London", "Madrid"]),
            new City(io, game_id, "Atlanta", "blue", [0.188, 0.373], ["Washington", "Chicago", "Miami"]),
            new City(io, game_id, "Washington", "blue", [0.261, 0.368], ["New York", "Toronto", "Miami", "Atlanta"]),
            new City(io, game_id, "Madrid", "blue", [0.402, 0.347], ["New York", "London", "Paris", "Algiers", "Sao Paulo"]),
            new City(io, game_id, "London", "blue", [0.412, 0.251], ["New York", "Madrid", "Paris", "Essen"]),
            new City(io, game_id, "Essen", "blue", [0.481, 0.235], ["London", "Paris", "Milan", "St. Petersburg"]),
            new City(io, game_id, "Paris", "blue", [0.464, 0.3], ["London", "Madrid", "Milan", "Essen", "Algiers"]),
            new City(io, game_id, "Milan", "blue", [0.51, 0.282], ["Paris", "Essen", "Istanbul"]),
            new City(io, game_id, "St. Petersburg", "blue", [0.558, 0.214], ["Essen", "Moscow", "Istanbul"]),

            new City(io, game_id, "Los Angeles", "yellow", [0.088, 0.436], ["Sydney", "Mexico City", "San Francisco", "Chicago"]), // Yellow
            new City(io, game_id, "Mexico City", "yellow", [0.152, 0.467], ["Los Angeles", "Chicago", "Miami", "Bogota", "Lima"]),
            new City(io, game_id, "Miami", "yellow", [0.231, 0.454], ["Atlanta", "Washington", "Bogota", "Mexico City"]),
            new City(io, game_id, "Bogota", "yellow", [0.225, 0.552], ["Miami", "Mexico City", "Lima", "Sao Paulo", "Buenos Aires"]),
            new City(io, game_id, "Lima", "yellow", [0.20, 0.657], ["Mexico City", "Bogota", "Santiago"]),
            new City(io, game_id, "Sao Paulo", "yellow", [0.323, 0.673], ["Buenos Aires", "Bogota", "Lagos", "Madrid"]),
            new City(io, game_id, "Buenos Aires", "yellow", [0.283, 0.746], ["Sao Paulo", "Bogota"]),
            new City(io, game_id, "Santiago", "yellow", [0.21, 0.765], ["Lima"]),
            new City(io, game_id, "Lagos", "yellow", [0.457, 0.535], ["Kinshasa", "Khartoum", "Sao Paulo"]),
            new City(io, game_id, "Khartoum", "yellow", [0.545, 0.516], ["Cairo", "Johannesburg", "Lagos", "Kinshasa"]),
            new City(io, game_id, "Kinshasa", "yellow", [0.501, 0.603], ["Lagos", "Khartoum", "Johannesburg"]),
            new City(io, game_id, "Johannesburg", "yellow", [0.538, 0.70], ["Kinshasa", "Khartoum"]),

            new City(io, game_id, "Algiers", "black", [0.479, 0.4], ["Madrid", "Paris", "Istanbul", "Cairo"]), // Black
            new City(io, game_id, "Istanbul", "black", [0.54, 0.337], ["Milan", "Algiers", "St. Petersburg", "Moscow", "Baghdad", "Cairo"]),
            new City(io, game_id, "Moscow", "black", [0.594, 0.281], ["St. Petersburg", "Istanbul", "Tehran"]),
            new City(io, game_id, "Tehran", "black", [0.643, 0.326], ["Moscow", "Baghdad", "Karachi", "Delhi"]),
            new City(io, game_id, "Baghdad", "black", [0.59, 0.387], ["Istanbul", "Cairo", "Riyadh", "Karachi", "Tehran"]),
            new City(io, game_id, "Cairo", "black", [0.531, 0.419], ["Algiers", "Istanbul", "Baghdad", "Riyadh", "Khartoum"]),
            new City(io, game_id, "Riyadh", "black", [0.599, 0.474], ["Cairo", "Baghdad", "Karachi"]),
            new City(io, game_id, "Karachi", "black", [0.655, 0.418], ["Riyadh", "Baghdad", "Tehran", "Delhi", "Mumbai"]),
            new City(io, game_id, "Delhi", "black", [0.707, 0.39], ["Tehran", "Karachi", "Mumbai", "Chennai", "Kolkata"]),
            new City(io, game_id, "Kolkata", "black", [0.755, 0.414], ["Delhi", "Chennai", "Bangkok", "Hong Kong"]),
            new City(io, game_id, "Mumbai", "black", [0.663, 0.491], ["Karachi", "Delhi", "Chennai"]),
            new City(io, game_id, "Chennai", "black", [0.716, 0.544], ["Mumbai", "Delhi", "Kolkata", "Bangkok", "Jakarta"]),

            new City(io, game_id, "Beijing", "red", [0.794, 0.304], ["Seoul", "Shanghai"]), // Red
            new City(io, game_id, "Seoul", "red", [0.856, 0.299], ["Beijing", "Tokyo", "Shanghai"]),
            new City(io, game_id, "Shanghai", "red", [0.798, 0.371], ["Beijing", "Seoul", "Hong Kong", "Taipei", "Tokyo"]),
            new City(io, game_id, "Tokyo", "red", [0.903, 0.337], ["Seoul", "Shanghai", "Osaka", "San Francisco"]),
            new City(io, game_id, "Osaka", "red", [0.908, 0.412], ["Tokyo", "Taipei"]),
            new City(io, game_id, "Taipei", "red", [0.858, 0.44], ["Osaka", "Shanghai", "Hong Kong", "Manila"]),
            new City(io, game_id, "Hong Kong", "red", [0.804, 0.453], ["Kolkata", "Shanghai", "Taipei", "Manila", "Ho Chi Minh City", "Bangkok"]),
            new City(io, game_id, "Bangkok", "red", [0.764, 0.497], ["Kolkata", "Chennai", "Jakarta", "Ho Chi Minh City", "Hong Kong"]),
            new City(io, game_id, "Manila", "red", [0.874, 0.562], ["Taipei", "Ho Chi Minh City", "San Francisco", "Sydney", "Hong Kong"]),
            new City(io, game_id, "Ho Chi Minh City", "red", [0.807, 0.568], ["Jakarta", "Bangkok", "Hong Kong", "Manila"]),
            new City(io, game_id, "Jakarta", "red", [0.764, 0.628], ["Chennai", "Bangkok", "Ho Chi Minh City", "Sydney"]),
            new City(io, game_id, "Sydney", "red", [0.914, 0.76], ["Jakarta", "Manila", "Los Angeles"]),
        ];
        var cities = {};
        var c;
        for (c of city_list) {
            cities[c.name] = c;
        }
        return cities;
    },

    City: City
}