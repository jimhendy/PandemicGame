const images = require('./images')

class Markers {
    constructor(io, game_id) {

        this.io = io;
        this.game_id = game_id;

        this.outbreak_locations = this.create_outbreak_marker_locations();
        this.infection_rate_locations = this.create_infection_rate_locations();

        this.infection_rate_loc = 0;
        this.outbreak_loc = 0;

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
        var data = this._outbrak_marker_data();
        data.x = this.outbreak_locations[0][0]
        data.y = this.outbreak_locations[0][1]
        this.io.in(this.game_id).emit(
            "createImage", data
        );
    };

    create_infection_rate_marker() {
        var data = this._infection_rate_marker_data();
        data.x = this.infection_rate_locations[0][0]
        data.y = this.infection_rate_locations[0][1]
        this.io.in(this.game_id).emit(
            "createImage", data
        );
    };

    _infection_rate_marker_data(){
        return {
            img_type: "marker",
            img_name: "infection_rate_marker",
            image_file: "images/game/Marker Infection Rate.png",
            dx: 0.032,
            dy: 0.042,
            dt: 1
        }
    }

    _outbrak_marker_data(){
        return {
            img_type: "marker",
            img_name: "outbreak_marker",
            image_file: "images/game/Marker Outbreak.png",
            dx: 0.032,
            dy: 0.042,
            dt: 1
        }
    }

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

    increase_infection_rate(){
        var data = this._infection_rate_marker_data();
        data.x = this.infection_rate_locations[this.infection_rate_loc][0]
        data.y = this.infection_rate_locations[this.infection_rate_loc][1]
        this.infection_rate_loc++;
        data.dest_x = this.infection_rate_locations[this.infection_rate_loc][0]
        data.dest_y = this.infection_rate_locations[this.infection_rate_loc][1]
        this.io.in(this.game_id).emit(
            "moveImage", data
        );
    }

    increase_outbreaks(n_outbreaks=1){
        
        var data = this._outbrak_marker_data();
        data.x = this.outbreak_locations[this.outbreak_loc][0]
        data.y = this.outbreak_locations[this.outbreak_loc][1]
        this.outbreak_loc += n_outbreaks;
        var too_many_outbreaks = false;
        if (this.outbreak_loc >= this.outbreak_locations.length){
            this.io.in(this.game_id).emit(
                "gameOver", {message: "Too many outbreaks, you lose!"}
            )
            too_many_outbreaks = true;
            data.dest_x = this.outbreak_locations[this.outbreak_locations.length-1][0]
            data.dest_y = this.outbreak_locations[this.outbreak_locations.length-1][1]
        } else {
            data.dest_x = this.outbreak_locations[this.outbreak_loc][0]
            data.dest_y = this.outbreak_locations[this.outbreak_loc][1]
        }
        this.io.in(this.game_id).emit(
            "moveImage", data
        );
        return too_many_outbreaks;
    }

}

module.exports = Markers