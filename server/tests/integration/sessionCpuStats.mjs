const port = 6390;
const replyTimeoutMs = 5000;

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

const socket = new WebSocket(`ws://127.0.0.1:${port}`);
socket.onerror = () => fail('connection failed');

function waitFor(expected) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => fail(`no ${expected} within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            if (message.message !== expected) return;
            clearTimeout(timer);
            resolve(message);
        };
    });
}

function send(message) {
    socket.send(`json:${JSON.stringify({ message })}`);
}

await waitFor('monitor_config');

send('get_all_filters');
const filtersReply = await waitFor('filters');
const inspectFilter = filtersReply.filters.find((filter) => filter.type === 'inspect');
if (!inspectFilter) fail('no inspect filter in graph');

send('subscribe_session');
const sessionReply = await waitFor('session_stats');
const inspectStats = sessionReply.stats.find((filterStats) => filterStats.idx === inspectFilter.idx);
if (!inspectStats) fail(`session_stats has no entry for inspect idx ${inspectFilter.idx}`);
console.log(`session_stats inspect pck_done ${inspectStats.pck_done}`);

send('subscribe_cpu_stats');
const cpuReply = await waitFor('cpu_stats');
if (typeof cpuReply.stats.nb_cores !== 'number') fail('cpu_stats.nb_cores is not a number');
console.log(`cpu_stats nb_cores ${cpuReply.stats.nb_cores}`);

socket.close();
process.exit(0);
