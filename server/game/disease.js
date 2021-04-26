const utils = require("./utils")

class Disease {
    constructor(io, game_id, colour, x_loc){
        this.io = io;
        this.game_id = game_id;

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
            "createImage",
            {
                img_type: "vial",
                img_name: this.img_name,
                image_file: this.vial_file,
                x: this.x_loc_frac,
                y: this.y_loc_frac,
                dx: this.dx_frac,
                dy: this.dy_frac
            }
        )
    }

    add_cube(){
        this.cubes_on_board++;
        if (this.cubes_on_board > this.total_cubes){
            this.io.in(this.game_id).emit(
                "gameLost",
                {
                    message: utils.toTitleCase(this.colour) + " diease attempted to add more cubes than are provided in the game. Game Lost"
                }
            )
        }
    }

    remove_cube(){
        this.cubes_on_board--;
    }

    cure(){
        this.io.in(this.game_id).emit(
            "logMessage",
            {
                message: "The " + this.colour + " disease is cured!",
                fontWeight: "bold",
                color: this.colour
            }
        )
        this.cured = true;
        this.io.in(this.game_id).emit(
            "moveImage",
            {
                img_name: this.img_name,
                dest_y: this.y_loc_cured_frac,
                dt: 1
            }
        )
    }

    eradicate(){
        this.io.in(this.game_id).emit(
            "logMessage",
            {
                message: "The " + this.colour + " disease is ERADICATED!",
                fontWeight: "bold",
                color: this.colour
            }
        )
        this.eradicated = true;
        this.io.in(this.game_id).emit(
            "alterImage",
            {
                img_name: this.img_name,
                new_image_file: this.vial_file_eradicated
            }
        )
    }
}

module.exports = {
    create_new_diseases: function(io, game_id){
        return {
            "yellow": new Disease(io, game_id, "yellow", 0.328),
            "red": new Disease(io, game_id, "red", 0.374),
            "blue": new Disease(io, game_id, "blue", 0.42),
            "black": new Disease(io, game_id, "black", 0.462)
        }
    },
    
    Disease: Disease
}