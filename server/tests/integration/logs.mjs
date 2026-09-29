const port = 6390;
const replyTimeoutMs = 5000;
const debugLevel = 4;

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

const socket = new WebSocket(`ws://127.0.0.1:${port}`);
socket.onerror = () => fail('connection failed');

function waitFor(expected, isMatch = () => true) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => fail(`no matching ${expected} within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            if (message.message !== expected || !isMatch(message)) return;
            clearTimeout(timer);
            resolve(message);
        };
    });
}

function send(message, fields = {}) {
    socket.send(`json:${JSON.stringify({ message, ...fields })}`);
}

const isFilterDebugLog = (log) => log.tool === 'filter' && log.level === debugLevel;

await waitFor('monitor_config');

send('subscribe_logs', { logLevel: 'all@warning' });
const logBatch = await waitFor('log_batch', (batch) => batch.logs.some(isFilterDebugLog));
const filterLog = logBatch.logs.find(isFilterDebugLog);
console.log(`log_batch filter debug: ${filterLog.message.trim()}`);

socket.close();
process.exit(0);
