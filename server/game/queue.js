class Queue {

    /*
    Tasks run in order. A task can wait for clients to finish (e.g. an animation) before
    the next one starts:
      0           don't wait (server side work, or nothing to wait for)
      "all"       wait for every connected player
      [pids]      wait for these players, if connected
      n > 0       wait until a player answers (queue.start() is called with their answer)
      "game_over" stop for good

    Waiting is by player, so a player who disconnects is dropped from the wait instead of
    stalling the game, and stray or repeated responses are ignored.
    */

    constructor(connected_pids, on_settle = null, label = "") {
        this.label = label; // which game, in the server log
        this.connected_pids = connected_pids; // () => [pid]
        this.on_settle = on_settle; // called when the queue empties or waits for a player

        this._queue = [];

        this.awaiting = new Set(); // pids still to finish the current task
        this.awaiting_count = 0; // for tasks waiting on a player's answer
        this.running = false;
        this.game_over = false;

        // Bind Events
        this.start = this.start.bind(this);
        this.add_task = this.add_task.bind(this);
        this.add_response = this.add_response.bind(this);
        this.drop = this.drop.bind(this);
        this._next_task = this._next_task.bind(this);
        this.size = this.size.bind(this);
        this._check_next_task = this._check_next_task.bind(this);
        this.run_until_empty = this.run_until_empty.bind(this);
    }

    get awaiting_responses() { return this.awaiting.size + this.awaiting_count; }

    start() {
        if (this.game_over) { return; }
        this.running = true;
        if (this.size())
            this._next_task();
    }

    async run_until_empty() {
        return new Promise(
            resolve => {
                // Resolve on a later tick, so a loop awaiting this can't starve the server
                if (this.game_over) { setTimeout(resolve, 0); return; }
                this.running = true;
                var id = setInterval(check_queue.bind(this), 50);
                function check_queue() {
                    if (this.game_over) {
                        clearInterval(id);
                        resolve();
                    } else if (this.size()) {
                        this._check_next_task();
                    } else if (this.awaiting_responses == 0) {
                        clearInterval(id);
                        resolve();
                    }
                }
            });
    }

    add_task(func, args, n_players_response, description = null, front = false, pause = false) {
        /*
        pause: stop the queue running after executing this task (before getting any responses)
        */
        var data = {
            func: func,
            args: Array.isArray(args) ? args : [args],
            responders: n_players_response,
            description: description,
            pause: pause,
            game_over: n_players_response == "game_over"
        }
        if (front) {
            this._queue.unshift(data)
        } else {
            this._queue.push(data)
        }
    }

    add_response(pid) {
        if (!this.awaiting.delete(pid)) return; // not waiting on this player
        this._check_next_task()
    }

    // A player disconnected: stop waiting for them
    drop(pid) {
        if (this.awaiting.delete(pid)) this._check_next_task();
    }

    _check_next_task() {
        if (this.game_over) { return; }
        if (this.awaiting_responses == 0 && this.running) {
            if (this.size())
                this._next_task();
            else {
                this.running = false;
                this._settle();
            }
        }
    }

    _next_task() {
        if (this.game_over) { return; }
        if (!this.size()) return;
        var instruction = this._queue.shift();
        this.current = instruction.description;
        if (instruction.description)
            console.info("[" + this.label + "] " + instruction.description)

        var responders = instruction.responders;
        this.awaiting = new Set();
        this.awaiting_count = 0;
        if (responders == "all") {
            this.awaiting = new Set(this.connected_pids());
        } else if (Array.isArray(responders)) {
            var connected = this.connected_pids();
            this.awaiting = new Set(responders.filter((pid) => connected.includes(pid)));
        } else if (typeof responders == "number") {
            this.awaiting_count = responders;
        }

        try {
            instruction.func(...instruction.args);
        } catch (err) {
            console.error("Task failed: " + instruction.description, err);
            this.awaiting = new Set();
        }
        this.game_over = instruction.game_over;
        this.running = !instruction.pause;
        if (this.awaiting_count || instruction.pause) this._settle(); // waiting for a player to choose
        if (this.awaiting_responses == 0 && this.running)
            this._next_task();
    }

    _settle() {
        if (this.on_settle) {
            try { this.on_settle(); } catch (err) { console.error(err); }
        }
    }

    size() {
        return this._queue.length;
    }

    debug_state() {
        return {
            current: this.current, running: this.running, game_over: this.game_over,
            awaiting: [...this.awaiting], awaiting_count: this.awaiting_count,
            next: this._queue.slice(0, 5).map((t) => t.description)
        };
    }

}

module.exports = Queue;
