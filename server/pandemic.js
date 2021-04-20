function array_from_objects_list(objects_list, attribute) {
    var results = [];
    for (var i = 0; i < objects_list.length; i++) {
        results.push(objects_list[i][attribute])
    }
    return results;
}

function objects_attribute_contains_value(objects_list, attribute, value) {
    for (var i = 0; i < objects_list.length; i++) {
        if (objects_list[i][attribute] == value)
            return true;
    }
    return false;
}

function dict_from_objects(objects_list, key, value) {
    var results = {};
    for (var i = 0; i < objects_list.length; i++) {
        results[objects_list[i][key]] = objects_list[i][value];
    }
    return results;
}

function key_from_value(dict, desired_value) {
    for (const [key, value] of Object.entries(dict)) {
        if (value == desired_value)
            return key;
    }
    return null;
}


class Pandemic {
    constructor(io) {
        this.io = io;
        this.gameId = Math.floor(Math.random() * 99999999);
        console.log("Game ID: " + this.gameId);
        this.all_roles = [
            "Contingency Planner",
            "Dispatcher",
            "Medic",
            "Operations Expert",
            "Quarantine Specialist",
            "Researcher",
            "Scientist"
        ]
        this.users = {
            10: {
                "username": "Tom",
                "role": "Medic"
            }
        }; // socketId to client data
    }

    add_user(data, socket) {
        this.users[data.socketId] = data;
        console.log('Player "' + data.username + '" joining game');
        socket.emit("userJoinRoom", this._role_choice_data());
    }

    _role_choice_data() {
        return {
            assigned_roles: dict_from_objects(
                Object.values(this.users),
                "username", "role"
            ),
            all_roles: this.all_roles
        }
    }

    remove_user(socket_id) {
        console.log('User has disconnected.');
        if (socket_id in this.users) {
            delete this.users[socket_id];
            // TODO emit user lost?
        }
    }

    assign_role(data) {
        this.users[data.socketId].role = data.role;
        this.io.in(this.gameId).emit('reloadRolesSelection', this._role_choice_data());
    }
}

module.exports = Pandemic