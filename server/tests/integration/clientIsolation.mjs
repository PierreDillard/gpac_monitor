const port = 6390;
const replyTimeoutMs = 5000;

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

function openClient(label) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onerror = () => fail(`${label}: connection failed`);

    const waitFor = (expected) => new Promise((resolve) => {
        const timer = setTimeout(() => fail(`${label}: no ${expected} within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            if (message.message !== expected) return;
            clearTimeout(timer);
            resolve(message);
        };
    });

    const waitForClose = () => new Promise((resolve) => {
        const timer = setTimeout(() => fail(`${label}: not closed within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onclose = () => {
            clearTimeout(timer);
            resolve();
        };
    });

    const send = (message) => socket.send(`json:${JSON.stringify({ message })}`);

    return { socket, waitFor, waitForClose, send };
}

const cycleCount = 3;

const witness = openClient('witness');
await witness.waitFor('monitor_config');
witness.send('subscribe_session');
await witness.waitFor('session_stats');

for (let cycle = 1; cycle <= cycleCount; cycle++) {
    const leaving = openClient(`leaving #${cycle}`);
    await leaving.waitFor('monitor_config');
    leaving.send('subscribe_session');
    await leaving.waitFor('session_stats');

    witness.send('unsubscribe_session');
    leaving.socket.onerror = null;
    leaving.socket.close();
    await leaving.waitForClose();

    const afterClose = await witness.waitFor('session_stats');
    console.log(`cycle ${cycle}: witness session_stats after leaving closed (${afterClose.stats.length} filters)`);
}

witness.socket.close();
process.exit(0);
