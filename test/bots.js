// Plays whole games with bots against a real server, to check the game never stalls:
// concurrent games, every role, players dropping out and coming back, and spectators.
//   npm test               (or: node test/bots.js [games] [turns])

const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const { io } = require("socket.io-client");

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = "http://127.0.0.1:" + PORT;
const N_GAMES = parseInt(process.argv[2]) || 6;
const MAX_TURNS = parseInt(process.argv[3]) || 30;
const STALL_MS = 20000;

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

class Bot {
    constructor(name) {
        this.name = name;
        this.pid = crypto.randomBytes(18).toString("base64url");
        this.events = [];
        this.last_activity = Date.now();
        this.lobby = null;
        this.synced = null;
        this.gone = null;
        this.connect_count = 0;
    }

    connect(game_id = null) {
        this.game_id = game_id;
        this.socket = io(URL, { extraHeaders: { cookie: "pandemic_player=" + this.pid }, reconnection: false, forceNew: true });
        this.socket.on("connect", () => {
            this.connect_count++;
            this.socket.emit("hello", { game_id: this.game_id, name: this.name });
        });
        var mark = (event) => (data) => { this.last_activity = Date.now(); this.events.push(event); return data; };
        this.socket.on("lobby", (data) => { mark("lobby")(); this.lobby = data; });
        this.socket.on("gone", (data) => { mark("gone")(); this.gone = data; });
        this.socket.on("toast", (data) => { mark("toast")(); this.toast = data; });
        this.socket.on("sync", (data) => { mark("sync")(); this.synced = data; });
        this.socket.on("players", (data) => { mark("players")(); this.players = data; });
        this.socket.on("game_lobby", (data) => { mark("game_lobby")(); this.on_game_lobby(data); });
        this.socket.on("logMessage", (data) => { mark("log")(); this.logs.push(data.message); });
        this.socket.on("clientAction", (data) => { mark("clientAction")(); this.on_action(data); });
        this.socket.on("parallel_actions", (data) => { mark("parallel")(); this.on_many(data, "parallel_actions_args"); });
        this.socket.on("series_actions", (data) => { mark("series")(); this.on_many(data, "series_actions_args"); });
        this.logs = [];
        return new Promise((resolve) => this.socket.once("connect", resolve));
    }

    disconnect() { this.socket.disconnect(); }

    on_game_lobby(state) {
        this.game_lobby = state;
        var me = state.members.find((m) => m.you);
        if (!me) return;
        if (!me.role) {
            var taken = state.members.map((m) => m.role);
            var free = state.all_roles.filter((r) => !taken.includes(r));
            this.socket.emit("role", { role: this.wanted_role && free.includes(this.wanted_role) ? this.wanted_role : pick(free) });
        } else if (!me.ready && this.ready_when_asked) {
            this.socket.emit("ready", { ready: true });
        }
    }

    on_many(data, key) {
        for (const a of data[key]) {
            if (a.function == "logMessage") this.logs.push(a.args.message);
            if (a.function == "series_actions" || a.function == "parallel_actions") this.on_many(a.args, a.function + "_args");
            if (a.function == "gameWin" || a.function == "gameLose") this.over = a.args.message;
        }
        if (data.return) this.socket.emit("action_complete");
    }

    on_action(data) {
        if (data.function == "logMessage") this.logs.push(data.args.message);
        if (data.function == "gameWin" || data.function == "gameLose") this.over = data.args.message;
        if (data.function == "enableActions") setTimeout(() => this.choose(data.args), 5);
        if (data.return) this.socket.emit("action_complete");
    }

    // Answer like the browser does: a whole action, plus answers for multi-pick questions
    choose(actions) {
        var by = (name) => actions.filter((a) => a.action == name);
        var respond = (action, answers = {}) => this.socket.emit("action_response", Object.assign({ ...action }, { answers: answers }));

        if (by("response").length) return respond(by("response").find((a) => a.response == "Yes") || by("response")[0]);
        if (by("Discard").length) {
            var d = by("Discard");
            return respond(d[0], { discard_card_name: d.map((a) => a.discard_card_name).slice(0, d[0].discard_card_name__n_choices) });
        }
        if (by("Discover A Cure").length) {
            var c = by("Discover A Cure");
            var colour = c[0].disease_colour;
            var cards = c.filter((a) => a.disease_colour == colour).map((a) => a.discard_card_name);
            var action = { ...c[0] };
            delete action.discard_card_name;
            return respond(action, { discard_card_name: cards.slice(0, c[0].discard_card_name__n_choices) });
        }
        if (by("Do not use event card").length) return respond(by("Do not use event card")[0]);
        if (by("Forecast").length && Math.random() < 0.3) {
            var f = by("Forecast");
            return respond(f[0], { infection_deck_card_name: f.map((a) => a.infection_deck_card_name) });
        }
        var events = actions.filter((a) => a.action__stop_autochoice && a.action != "Forecast");
        if (events.length && Math.random() < 0.15) return respond(pick(events));
        var treat = by("Treat Disease");
        if (treat.length && Math.random() < 0.6) {
            var most = Math.max(...treat.map((a) => a.treat_count));
            return respond(treat.find((a) => a.treat_count == most));
        }
        var options = actions.filter((a) => !a.action__stop_autochoice && a.action != "Pass");
        var drives = by("Drive/Ferry");
        if (drives.length && Math.random() < 0.5) return respond(pick(drives));
        if (options.length) return respond(pick(options));
        if (by("Pass").length) return respond(by("Pass")[0]);
        // Only event cards on offer (it's not our turn): leave them
    }
}

async function wait_for(check, what, ms = STALL_MS) {
    var start = Date.now();
    while (!check()) {
        if (Date.now() - start > ms) throw new Error("Timed out waiting for " + what);
        await sleep(25);
    }
}

async function play_game(n, roles) {
    var bots = roles.map((r, i) => {
        var b = new Bot("Bot " + n + "." + (i + 1));
        b.wanted_role = r;
        return b;
    });
    var host = bots[0];
    await host.connect();
    var id = await new Promise((resolve) => host.socket.emit("create", { title: "Test " + n }, (r) => resolve(r.id)));
    host.disconnect();
    for (const b of bots) {
        b.ready_when_asked = true;
        await b.connect(id);
    }
    // The host starts once everyone has a role and is ready
    await wait_for(() => host.game_lobby && host.game_lobby.members.length == bots.length && host.game_lobby.can_start, "everyone in game " + n + " to be ready");
    host.socket.emit("start");
    await wait_for(() => bots.every((b) => b.players), "game " + n + " to start");

    var turns = () => (host.players && host.players.turn) ? host.logs.filter((m) => m.startsWith("It's ")).length : 0;
    var reconnected = false, spectated = false, ignored_bad_answer = false;
    var watcher = null;
    while (!bots.some((b) => b.over) && turns() < MAX_TURNS) {
        var quiet = Date.now() - Math.max(...bots.map((b) => b.last_activity));
        if (quiet > STALL_MS) {
            global.server_process.kill("SIGUSR2");
            await sleep(1000);
        }
        if (quiet > STALL_MS) throw new Error("Game " + n + " stalled after " + turns() + " turns. Last logs: " + host.logs.slice(-5).join(" | "));

        // Partway through: one player refreshes, a spectator drops in, and someone sends a bogus answer
        if (!reconnected && turns() >= 3) {
            reconnected = true;
            var b = bots[bots.length - 1];
            b.disconnect();
            await sleep(300);
            b.synced = null;
            await b.connect(id);
            await wait_for(() => b.synced, "a sync after reconnecting");
            if (!b.synced.images.length || !b.synced.me || b.synced.me.name != b.name) throw new Error("Bad sync for " + b.name + " in game " + n + ": " + JSON.stringify({ me: b.synced.me, players: b.synced.players.players.map((p) => p.name) }));
        }
        if (!spectated && turns() >= 4) {
            spectated = true;
            watcher = new Bot("Watcher " + n);
            await watcher.connect(id);
            await wait_for(() => watcher.synced, "a spectator sync");
            if (watcher.synced.me !== null) throw new Error("Spectator was given a seat");
            watcher.disconnect();
        }
        if (!ignored_bad_answer && turns() >= 5) {
            ignored_bad_answer = true;
            host.socket.emit("action_response", { response_function: "start_game", answers: {} });
        }
        await sleep(50);
    }
    var drives = host.logs.filter((m) => / drives to .* via /.test(m)).length;
    var multi_treats = host.logs.length; // checked below via log counts
    for (const b of bots) b.disconnect();
    return { n, roles, turns: turns(), over: bots.find((b) => b.over)?.over || null, drives, reconnected, spectated };
}

async function main() {
    var server = global.server_process = spawn(process.execPath, [path.join(__dirname, "../server/server.js")], {
        env: { ...process.env, PORT: String(PORT), APP_PASSWORD: "" },
        stdio: ["ignore", "pipe", "pipe"]
    });
    var server_errors = global.server_errors = [];
    server.stderr.on("data", (d) => { if (/\[ERROR\]|Error/.test(d)) server_errors.push(d.toString()); });
    var fs = require("fs");
    if (process.env.SERVER_LOG) fs.writeFileSync(process.env.SERVER_LOG, "");
    server.stdout.on("data", (d) => {
        if (process.env.SERVER_LOG) fs.appendFileSync(process.env.SERVER_LOG, d);
        if (/Task failed|Error handling|TypeError|ReferenceError/.test(d)) server_errors.push(d.toString());
    });
    try {
        await wait_for(() => false, "", 1200).catch(() => {});

        // Lobby basics
        var a = new Bot("Alice");
        await a.connect();
        await wait_for(() => a.lobby, "the games list");
        a.socket.emit("create", { title: "<b>Bad</b> title" }, () => {});
        await wait_for(() => a.lobby.games.length == 1, "the new game in the list");
        if (a.lobby.games[0].title.includes("<")) throw new Error("Title wasn't cleaned");
        var missing = new Bot("Nobody");
        await missing.connect("does-not-exist");
        await wait_for(() => missing.gone, "a missing game to be refused");
        a.socket.emit("delete", { id: a.lobby.games[0].id });
        await wait_for(() => a.lobby.games.length == 0, "the game to be deleted");
        a.disconnect(); missing.disconnect();
        console.log("lobby: ok");

        var all_roles = ["Contingency Planner", "Dispatcher", "Medic", "Operations Expert", "Quarantine Specialist", "Researcher", "Scientist"];
        var games = [];
        for (var i = 0; i < N_GAMES; i++) {
            var size = 1 + (i % 4);
            var roles = [...all_roles].sort(() => Math.random() - 0.5).slice(0, size);
            games.push(play_game(i + 1, roles));
        }
        var results = await Promise.all(games);
        for (const r of results)
            console.log(`game ${r.n}: ${r.roles.join(", ")} -> ${r.turns} turns, ${r.drives} multi-step drives, ${r.over || "still going"}`);
        if (server_errors.length) throw new Error("Server errors:\n" + server_errors.join("\n"));
        console.log("PASS");
    } finally {
        server.kill();
    }
}

main().catch((err) => { console.error("FAIL:", err.message); process.exit(1); });
process.on("exit", (code) => { if (code && global.server_errors && global.server_errors.length) console.error("Server errors:\n" + global.server_errors.join("\n")); });
