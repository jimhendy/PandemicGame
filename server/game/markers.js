
class Markers {
    constructor(io, game_id, queue) {

        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.outbreak_locations = this.create_outbreak_marker_locations();
        this.infection_rate_locations = this.create_infection_rate_locations();

        this.infection_rate_loc = 0;
        this.outbreak_loc = 0;

        this.create_outbreak_marker();
        this.create_infection_rate_marker();

        // Bind Events
        this.infection_rate = this.infection_rate.bind(this);
        this.create_infection_rate_locations = this.create_infection_rate_locations.bind(this);
        this.create_outbreak_marker = this.create_outbreak_marker.bind(this);
        this.create_infection_rate_marker = this.create_infection_rate_marker.bind(this);
        this.create_outbreak_marker_locations = this.create_outbreak_marker_locations.bind(this);
        this._infection_rate_marker_data = this._infection_rate_marker_data.bind(this);
        this._outbrak_marker_data = this._outbrak_marker_data.bind(this);
        this.increase_infection_rate = this.increase_infection_rate.bind(this);
        this.increase_outbreaks = this.increase_outbreaks.bind(this);
    };

    infection_rate() {
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
            "clientAction", { function: "createImage", args: data }
        );
    };

    create_infection_rate_marker() {
        var data = this._infection_rate_marker_data();
        data.x = this.infection_rate_locations[0][0]
        data.y = this.infection_rate_locations[0][1]
        this.io.in(this.game_id).emit(
            "clientAction", { function: "createImage", args: data }
        );
    };

    _infection_rate_marker_data() {
        return {
            img_type: "marker",
            img_name: "infection_rate_marker",
            image_file: "images/game/Marker Infection Rate.png",
            dx: 0.032,
            dy: 0.042,
            dt: 1
        }
    }

    _outbrak_marker_data() {
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

    increase_infection_rate() {
        var data = this._infection_rate_marker_data();
        data.x = this.infection_rate_locations[this.infection_rate_loc][0]
        data.y = this.infection_rate_locations[this.infection_rate_loc][1]
        this.infection_rate_loc++;
        data.dest_x = this.infection_rate_locations[this.infection_rate_loc][0]
        data.dest_y = this.infection_rate_locations[this.infection_rate_loc][1]
        this.queue.add_task(
            () => this.io.in(this.game_id).emit("clientAction", { function: "moveImage", args: data, return: true }),
            null, "all", "Increasing infection rate marker"
        );
    }

    increase_outbreaks() {
        var data = this._outbrak_marker_data();
        data.x = this.outbreak_locations[this.outbreak_loc][0]
        data.y = this.outbreak_locations[this.outbreak_loc][1]
        this.outbreak_loc++;
        var game_over = false;
        if (this.outbreak_loc >= (this.outbreak_locations.length - 1)) {
            data.dest_x = this.outbreak_locations[this.outbreak_locations.length - 1][0]
            data.dest_y = this.outbreak_locations[this.outbreak_locations.length - 1][1]
            game_over = true;
            this.outbreak_loc = this.outbreak_locations.length - 1; // Stops error if outbreak cascade occurs on final round
        } else {
            data.dest_x = this.outbreak_locations[this.outbreak_loc][0]
            data.dest_y = this.outbreak_locations[this.outbreak_loc][1]
        }
        if (game_over) {
            this.queue.add_task(
                () => this.io.in(this.game_id).emit("clientAction", { function: "gameLose", args: { message: "Too many outbreaks, you lose!" }, return: true }),
                null, "game_over", "Game over due to too many outbreaks", true
            )
        }
        this.queue.add_task(
            () => this.io.in(this.game_id).emit("clientAction", { function: "moveImage", args: data, return: true }),
            null, "all", "Increasing outbreaks marker", game_over
        )
        
    }

}

module.exports = Markers