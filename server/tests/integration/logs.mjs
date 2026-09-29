const port = 6390;
const replyTimeoutMs = 5000;
const debugLevel = 4;

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

const socket = new WebSocket(`ws://127.0.0.1:${port}`);
socket.onerror = () => fail('connection failed');

function waitForLog(tool, level) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => fail(`no ${tool} log at level ${level} within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            if (message.message !== 'log_batch') return;
            const matchingLog = message.logs.find((log) => log.tool === tool && log.level === level);
            if (!matchingLog) return;
            clearTimeout(timer);
            resolve(matchingLog);
        };
    });
}

function send(message, fields = {}) {
    socket.send(`json:${JSON.stringify({ message, ...fields })}`);
}

send('subscribe_logs', { logLevel: 'filter@debug' });
const filterLog = await waitForLog('filter', debugLevel);
console.log(`log_batch filter debug: ${filterLog.message.trim()}`);

socket.close();
process.exit(0);
