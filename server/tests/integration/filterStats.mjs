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

function send(message, fields = {}) {
    socket.send(`json:${JSON.stringify({ message, ...fields })}`);
}

await waitFor('monitor_config');

send('get_all_filters');
const filtersReply = await waitFor('filters');
const reframerFilter = filtersReply.filters.find((filter) => filter.type === 'reframer');
if (!reframerFilter) fail('no reframer filter in graph');

// send('subscribe_filter', { idx: reframerFilter.idx });
const statsReply = await waitFor('filter_stats');
if (statsReply.idx !== reframerFilter.idx) fail(`filter_stats idx ${statsReply.idx}, expected ${reframerFilter.idx}`);
const outputPidNames = Object.keys(statsReply.opids ?? {});
if (outputPidNames.length === 0) fail('filter_stats has no output pid for reframer');
console.log(`filter_stats reframer opids ${outputPidNames.join(', ')}`);

socket.close();
process.exit(0);
