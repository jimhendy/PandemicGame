// How a game talks to its clients. It wraps socket.io so the game can address players
// by a room that survives reconnects, and it watches what is broadcast to the whole
// game so players who reconnect get the log (and the end of the game) back.

function find_log_messages(data, out) {
    if (!data || typeof data !== "object") return;
    if (data.function === "logMessage") out.push(data.args);
    for (const key of ["parallel_actions_args", "series_actions_args"])
        for (const a of data[key] || []) find_log_messages(a, out);
    if (data.function === "series_actions" || data.function === "parallel_actions") find_log_messages(data.args, out);
}

class GameIO {
    constructor(io, game_id, on_broadcast) {
        this.io = io;
        this.game_id = game_id;
        this.on_broadcast = on_broadcast; // (event, data, log_messages)
    }

    in(room) { return this.to(room); }

    // Everyone in the game when room is the game id, otherwise one player's room
    to(room) { return this._emitter(this.io.to(room), room === this.game_id); }

    // Everyone in the game except one player
    others(player) { return this._emitter(this.io.to(this.game_id).except(player.room), true); }

    _emitter(target, broadcast) {
        return {
            emit: (event, data) => {
                if (broadcast) {
                    var logs = [];
                    if (event === "logMessage") logs.push(data);
                    else find_log_messages(data, logs);
                    this.on_broadcast(event, data, logs);
                }
                target.emit(event, data);
            }
        };
    }
}

module.exports = GameIO;
