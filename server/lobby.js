// The list of games, and everything players do before and between them: names,
// creating, joining, leaving and deleting games. Games live in memory, so a restart
// clears them.

const crypto = require("crypto");
const Pandemic = require("./pandemic");

const IDLE_MS = 3 * 24 * 60 * 60 * 1000; // games nobody has touched for this long are tidied away

function clean(text, max_length) {
    return String(text || "").replace(/[^\p{L}\p{N} .,'!?_-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max_length);
}

class Lobby {
    constructor(io) {
        this.io = io;
        this.games = new Map();
        this.names = new Map(); // pid -> name
        this._list_pending = false;
        setInterval(() => this._tidy(), 60 * 60 * 1000).unref();
        // kill -USR2 <pid> prints what every game is waiting for
        process.on("SIGUSR2", () => {
            for (const g of this.games.values())
                console.info("[" + g.game_id + "] " + g.phase + " " + JSON.stringify(g.game ? g.game.queue.debug_state() : null));
        });
    }

    connect(socket, pid) {
        socket.data.pid = pid;
        var on = (event, handler) => socket.on(event, (data, reply) => {
            try {
                handler(data || {}, typeof reply == "function" ? reply : () => {});
            } catch (err) {
                console.error("Error handling " + event, err);
                socket.emit("toast", { message: err.message || "Something went wrong." });
            }
        });
        var game = () => socket.data.game;

        on("hello", (data) => this.hello(socket, pid, data));
        on("set_name", (data) => this.set_name(pid, data.name));
        on("create", (data, reply) => reply({ id: this.create(pid, data.title) }));
        on("delete", (data) => this.delete(pid, data.id));
        on("leave", () => { if (game()) game().leave(pid); this._after_leave(game()); });
        on("role", (data) => game() && game().set_role(pid, data.role));
        on("epidemics", (data) => game() && game().set_epidemics(pid, data.number));
        on("ready", (data) => game() && game().set_ready(pid, data.ready));
        on("start", () => game() && game().start(pid));
        on("action_complete", () => game() && game().handle_complete(pid));
        on("action_response", (data) => game() && game().handle_response(pid, data));
        socket.on("disconnect", () => {
            if (game()) game().detach(socket, pid);
        });
    }

    hello(socket, pid, data) {
        var name = clean(data.name, 20);
        if (name) this.names.set(pid, name);
        if (socket.data.game) socket.data.game.detach(socket, pid);
        socket.data.game = null;
        for (const room of [...socket.rooms])
            if (room != socket.id) socket.leave(room);

        if (!data.game_id) {
            socket.join("lobby");
            socket.emit("lobby", { name: this.names.get(pid) || "", games: this._list(pid) });
            return;
        }
        var game = this.games.get(String(data.game_id));
        if (!game) {
            socket.emit("gone", { message: "That game doesn't exist any more." });
            return;
        }
        if (game.phase == "lobby" && !game.members.has(pid)) {
            if (!this.names.get(pid)) {
                socket.emit("gone", { message: "Choose a name first." });
                return;
            }
            try {
                game.join(pid, this.names.get(pid));
            } catch (err) {
                socket.emit("gone", { message: err.message });
                return;
            }
        }
        socket.data.game = game;
        game.attach(socket, pid); // players rejoin their seat; anyone else watches
    }

    set_name(pid, name) {
        name = clean(name, 20);
        if (!name) throw new Error("Names need at least one letter or number.");
        this.names.set(pid, name);
        for (const game of this.games.values()) game.rename(pid, name);
        this.list_changed();
    }

    create(pid, title) {
        var name = this.names.get(pid);
        if (!name) throw new Error("Choose a name first.");
        var id = crypto.randomBytes(6).toString("base64url");
        var game = new Pandemic(this.io, id, clean(title, 40) || name + "'s game", pid, () => this.list_changed());
        this.games.set(id, game);
        game.join(pid, name);
        return id;
    }

    delete(pid, id) {
        var game = this.games.get(String(id));
        if (!game) return;
        if (!game.can_delete(pid)) throw new Error("Only the host can delete a game that's still going.");
        this.games.delete(game.game_id);
        game.destroy("This game was deleted.");
        this.list_changed();
    }

    _after_leave(game) {
        if (game && game.phase == "lobby" && game.members.size == 0) {
            this.games.delete(game.game_id);
            this.list_changed();
        }
    }

    _list(pid) {
        return [...this.games.values()]
            .sort((a, b) => b.updated - a.updated)
            .map((g) => g.summary(pid));
    }

    // Refresh everyone looking at the games list (at most once per tick)
    list_changed() {
        if (this._list_pending) return;
        this._list_pending = true;
        setImmediate(async () => {
            this._list_pending = false;
            for (const s of await this.io.in("lobby").fetchSockets())
                s.emit("lobby", { name: this.names.get(s.data.pid) || "", games: this._list(s.data.pid) });
        });
    }

    _tidy() {
        var now = Date.now();
        for (const game of this.games.values()) {
            if (game.connected_player_pids().length == 0 && now - game.updated > IDLE_MS) {
                this.games.delete(game.game_id);
                game.destroy("This game was tidied away after a few quiet days.");
            }
        }
        this.list_changed();
    }
}

module.exports = Lobby;
