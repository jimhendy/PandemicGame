const images = require('./images')

class Markers {
    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.outbreak_locations = this.create_outbreak_marker_locations();
        this.infection_rate_locations = this.create_infection_rate_locations();

        this.infection_rate_loc = 0;

        this.create_outbreak_marker();
        this.create_infection_rate_marker();
    };

    infection_rate(){
        if (this.infection_rate_loc < 3)
            return 2;
        else if (this.infection_rate_loc < 5)
            return 3;
        else
            return 4
    }

    create_outbreak_marker() {
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "marker",
                img_name: "outbreak_marker",
                image_file: "images/game/Marker Outbreak.png",
                x: this.outbreak_locations[0][0],
                y: this.outbreak_locations[0][1],
                dx: 0.032,
                dy: 0.042    
            }
        )
    };

    create_infection_rate_marker() {
        this.io.in(this.game_id).emit(
            "createImage",
            {
                img_type: "marker",
                img_name: "infection_rate_marker",
                image_file: "images/game/Marker Infection Rate.png",
                x: this.infection_rate_locations[0][0],
                y: this.infection_rate_locations[0][1],
                dx: 0.032,
                dy: 0.042    
            }
        );
    };

    create_outbreak_marker_locations() {
        return [
            [0.063, 0.54],
            [0.0985, 0.583],
            [0.063, 0.6225],
            [0.0985, 0.664],
            [0.063, 0.705],
            [0.0985, 0.745],
            [0.063, 0.782],
            [0.0985, 0.821],
            [0.063, 0.861]
        ];
    };

    create_infection_rate_locations() {
        return [
            [0.627, 0.211],
            [0.662, 0.211],
            [0.695, 0.211],
            [0.73, 0.211],
            [0.763, 0.211],
            [0.797, 0.211],
            [0.831, 0.211]
        ];
    }

}

module.exports = Markers