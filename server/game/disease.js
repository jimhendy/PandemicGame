const utils = require("./utils")

class Disease {
    constructor(io, game_id, queue, colour, x_loc){
        this.io = io;
        this.game_id = game_id;
        this.queue = queue;

        this.colour = colour.toLowerCase();
        this.cured = false;
        this.eradicated = false;
        this.x_loc_frac = x_loc; // frac of board canvas
        this.y_loc_frac = 0.915;
        this.y_loc_cured_frac = 0.85;
        this.dx_frac = 0.025;
        this.dy_frac = 0.04;
        this.vial_file = "images/game/vials/Vial " + utils.toTitleCase(this.colour) + ".png"
        this.vial_file_eradicated = this.vial_file.replace(".png", " Eradicated.png")
        this.total_cubes = 24; // can lose the game if we run out
        this.cubes_on_board = 0;
        this.img_name = "vial_" + this.colour

        this.io.in(this.game_id).emit(
            "clientAction",
            {
                function: "createImage",
                args:{
                    img_type: "vial",
                    img_name: this.img_name,
                    image_file: this.vial_file,
                    x: this.x_loc_frac,
                    y: this.y_loc_frac,
                    dx: this.dx_frac,
                    dy: this.dy_frac
                }
            }
        )

        // Bind Events
        this.add_cube = this.add_cube.bind(this);
        this.remove_cube = this.remove_cube.bind(this);
        this.cure = this.cure.bind(this);
        this.eradicate = this.eradicate.bind(this);
    }

    add_cube(){
        this.cubes_on_board++;
        if (this.cubes_on_board > this.total_cubes){
            this.queue.add_task(
                () => this.io.in(this.game_id).emit("clientAction", { function: "gameOver", args: { message: utils.toTitleCase(this.colour) + " diease attempted to add more cubes than are provided in the game. Game Lost" } }),
                null, "game_over", "Game over as we have run out of " + this.colour + " cubes."
            )
        }
    }

    remove_cube(){
        this.cubes_on_board--;
    }

    cure(){
        this.cured = true;
        this.queue.add_task(
            () => {
                this.io.in(this.game_id).emit(
                    "parallel_actions",
                    {
                        parallel_actions_args: [
                            {
                                function: "logMessage",
                                args: {
                                    message: "The " + this.colour + " disease is cured!",
                                    fontWeight: "bold",
                                    color: this.colour
                                }
                            },
                            {
                                function: "moveImage",
                                args: {
                                    img_name: this.img_name,
                                    dest_y: this.y_loc_cured_frac,
                                    dt: 1
                                }
                            }
                        ],
                        return: true
                    }
                )
            },
            null, "all", "Curing " + this.colour + " disease."
        );
    }

    eradicate(){
        this.eradicated = true;
        this.queue.add_task(
            () => {
                this.io.in(this.game_id).emit(
                    "parallel_actions",
                    {
                        parallel_actions_args: [
                            {
                                function: "logMessage",
                                args: {
                                    message: "The " + this.colour + " disease is ERADICATED!",
                                    fontWeight: "bold",
                                    color: this.colour
                                }
                            },
                            {
                                function: "alterImage",
                                args: {
                                    img_name: this.img_name,
                                    new_image_file: this.vial_file_eradicated
                                }
                            }
                        ],
                        return: true
                    }
                )
            },
            null, "all", "Eradicating " + this.colour + " disease."
        );
    }
}

module.exports = {
    create_new_diseases: function(io, game_id, queue){
        return {
            "yellow": new Disease(io, game_id, queue, "yellow", 0.328),
            "red": new Disease(io, game_id, queue, "red", 0.374),
            "blue": new Disease(io, game_id, queue, "blue", 0.42),
            "black": new Disease(io, game_id, queue, "black", 0.462)
        }
    },
    
    Disease: Disease
}