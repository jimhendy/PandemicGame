class City {
    constructor(io, gameId, name, native_disease_colour, location, adjacent_cities) {
        this.io = io;
        this.gameId = gameId;

        this.name = name;
        this.native_disease_colour = native_disease_colour;
        this.location = location;
        this.adjacent_cities = adjacent_cities;
        this.disease_cubes = {
            "yellow": 0,
            "red": 0,
            "blue": 0,
            "black": 0
        };
        /*
        this.img_reseach_station = null;
        this.img_players = [];
        this.img_cubes = {
            "yellow": [],
            "red": [],
            "blue": [],
            "black": []
        };
        */

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
        colour = colour || this.native_disease_colour;
        var currrent_cubes = this.disease_cubes[colour];
        if (currrent_cubes < 3) {
            this.disease_cubes[colour]++;
            this.add_cube_image(this.disease_cubes[colour], colour)
        }
        else {
            // Outbreak
            if (ignore_cities) {
                ignore_cities.push(this.name)
            }
            else {
                ignore_cities = [this.name]
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
        console.log("Drawing cube in " + this.name)
        this.io.in(this.gameId).emit(
            "createImage",
            {
                image_file: "images/game/cubes/cube_" + colour + ".png",
                x: x, y: y, dx: 0.01, dy: 0.01,
                blinkCanvas: true
            }
        )
        /*
        this.img_cubes[colour].push(
            createImage(
                "images/cubes/cube_" + colour + ".png",
                cube_ctx,
                x, y, 0.01, 0.01
            )
        )
        */
        //cube_ctx.fillStyle = "#FFFFFF";
        //cube_ctx.fillRect(x * canvas.width, y * canvas.height, 0.01 * canvas.width, 0.01 * canvas.height);
    }

    remove_cube(colour) {
        this.disease_cubes[colour]--;
        var img = this.img_cubes[colour].pop();
        clearImage(img, cube_ctx);
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
}

module.exports = {
    create_cities: function (io, gameId) {
        city_list = [
            new City(io, gameId, "San Francisco", "blue", [0.074, 0.336], ["Chicago", "Tokyo", "Manila", "Los Angeles"]), // Blue
            new City(io, gameId, "Chicago", "blue", [0.162, 0.302], ["San Francisco", "Toronto", "Atlanta", "Los Angeles", "Mexico City"]),
            new City(io, gameId, "Toronto", "blue", [0.231, 0.298], ["New York", "Washington", "Chicago"]),
            new City(io, gameId, "New York", "blue", [0.284, 0.31], ["Toronto", "Washington", "London", "Madrid"]),
            new City(io, gameId, "Atlanta", "blue", [0.188, 0.373], ["Washington", "Chicago", "Miami"]),
            new City(io, gameId, "Washington", "blue", [0.261, 0.368], ["New York", "Toronto", "Miami", "Atlanta"]),
            new City(io, gameId, "Madrid", "blue", [0.402, 0.347], ["New York", "London", "Paris", "Algiers", "Sao Paulo"]),
            new City(io, gameId, "London", "blue", [0.412, 0.251], ["New York", "Madrid", "Paris", "Essen"]),
            new City(io, gameId, "Essen", "blue", [0.481, 0.235], ["London", "Paris", "Milan", "St. Petersburg"]),
            new City(io, gameId, "Paris", "blue", [0.464, 0.3], ["London", "Madrid", "Milan", "Essen", "Algiers"]),
            new City(io, gameId, "Milan", "blue", [0.51, 0.282], ["Paris", "Essen", "Istanbul"]),
            new City(io, gameId, "St. Petersburg", "blue", [0.558, 0.214], ["Essen", "Moscow", "Istanbul"]),

            new City(io, gameId, "Los Angeles", "yellow", [0.088, 0.436], ["Sydney", "Mexico City", "San Francisco", "Chicago"]), // Yellow
            new City(io, gameId, "Mexico City", "yellow", [0.152, 0.467], ["Los Angeles", "Chicago", "Miami", "Bogota", "Lima"]),
            new City(io, gameId, "Miami", "yellow", [0.231, 0.454], ["Atlanta", "Washington", "Bogota", "Mexico City"]),
            new City(io, gameId, "Bogota", "yellow", [0.225, 0.552], ["Miami", "Mexico City", "Lima", "Sao Paulo", "Buenos Aires"]),
            new City(io, gameId, "Lima", "yellow", [0.20, 0.657], ["Mexico City", "Bogota", "Santiago"]),
            new City(io, gameId, "Sao Paulo", "yellow", [0.323, 0.673], ["Buenos Aires", "Bogota", "Lagos", "Madrid"]),
            new City(io, gameId, "Buenos Aires", "yellow", [0.283, 0.746], ["Sao Paulo", "Bogota"]),
            new City(io, gameId, "Santiago", "yellow", [0.21, 0.765], ["Lima"]),
            new City(io, gameId, "Lagos", "yellow", [0.457, 0.535], ["Kinshasa", "Khartoum", "Sao Paulo"]),
            new City(io, gameId, "Khartoum", "yellow", [0.545, 0.516], ["Cairo", "Johannesburg", "Lagos", "Kinshasa"]),
            new City(io, gameId, "Kinshasa", "yellow", [0.501, 0.603], ["Lagos", "Khartoum", "Johannesburg"]),
            new City(io, gameId, "Johannesburg", "yellow", [0.538, 0.70], ["Kinshasa", "Khartoum"]),

            new City(io, gameId, "Algiers", "black", [0.479, 0.4], ["Madrid", "Paris", "Istanbul", "Cairo"]), // Black
            new City(io, gameId, "Istanbul", "black", [0.54, 0.337], ["Milan", "Algiers", "St. Petersburg", "Moscow", "Baghdad", "Cairo"]),
            new City(io, gameId, "Moscow", "black", [0.594, 0.281], ["St. Petersburg", "Istanbul", "Tehran"]),
            new City(io, gameId, "Tehran", "black", [0.643, 0.326], ["Moscow", "Baghdad", "Karachi", "Delhi"]),
            new City(io, gameId, "Baghdad", "black", [0.59, 0.387], ["Istanbul", "Cairo", "Riyadh", "Karachi", "Tehran"]),
            new City(io, gameId, "Cairo", "black", [0.531, 0.419], ["Algiers", "Istanbul", "Baghdad", "Riyadh", "Khartoum"]),
            new City(io, gameId, "Riyadh", "black", [0.599, 0.474], ["Cairo", "Baghdad", "Karachi"]),
            new City(io, gameId, "Karachi", "black", [0.655, 0.418], ["Riyadh", "Baghdad", "Tehran", "Delhi", "Mumbai"]),
            new City(io, gameId, "Delhi", "black", [0.707, 0.39], ["Tehran", "Karachi", "Mumbai", "Chennai", "Kolkata"]),
            new City(io, gameId, "Kolkata", "black", [0.755, 0.414], ["Delhi", "Chennai", "Bangkok", "Hong Kong"]),
            new City(io, gameId, "Mumbai", "black", [0.663, 0.491], ["Karachi", "Delhi", "Chennai"]),
            new City(io, gameId, "Chennai", "black", [0.716, 0.544], ["Mumbai", "Delhi", "Kolkata", "Bangkok", "Jakarta"]),

            new City(io, gameId, "Beijing", "red", [0.794, 0.304], ["Seoul", "Shanghai"]), // Red
            new City(io, gameId, "Seoul", "red", [0.856, 0.299], ["Beijing", "Tokyo", "Shanghai"]),
            new City(io, gameId, "Shanghai", "red", [0.798, 0.371], ["Beijing", "Seoul", "Hong Kong", "Taipei", "Tokyo"]),
            new City(io, gameId, "Tokyo", "red", [0.903, 0.337], ["Seoul", "Shanghai", "Osaka", "San Francisco"]),
            new City(io, gameId, "Osaka", "red", [0.908, 0.412], ["Tokyo", "Taipei"]),
            new City(io, gameId, "Taipei", "red", [0.858, 0.44], ["Osaka", "Shanghai", "Hong Kong", "Manila"]),
            new City(io, gameId, "Hong Kong", "red", [0.804, 0.453], ["Kolkata", "Shanghai", "Taipei", "Manila", "Ho Chi Minh City", "Bangkok"]),
            new City(io, gameId, "Bangkok", "red", [0.764, 0.497], ["Kolkata", "Chennai", "Jakarta", "Ho Chi Minh City", "Hong Kong"]),
            new City(io, gameId, "Manila", "red", [0.874, 0.562], ["Taipei", "Ho Chi Minh City", "San Francisco", "Sydney", "Hong Kong"]),
            new City(io, gameId, "Ho Chi Minh City", "red", [0.807, 0.568], ["Jakarta", "Bangkok", "Hong Kong", "Manila"]),
            new City(io, gameId, "Jakarta", "red", [0.764, 0.628], ["Chennai", "Bangkok", "Ho Chi Minh City", "Sydney"]),
            new City(io, gameId, "Sydney", "red", [0.914, 0.76], ["Jakarta", "Manila", "Los Angeles"]),
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