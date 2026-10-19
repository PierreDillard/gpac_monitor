// Second GPAC container, launched with -rmt-log (see backend-integration.yml)
const port = 6391;
const replyTimeoutMs = 5000;
// Shared budget for connecting and waiting for the first recorded session
const recordDeadline = Date.now() + 15000;

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

function connect() {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`);
        socket.onopen = () => resolve(socket);
        socket.onerror = () => reject(new Error('connection failed'));
    });
}

// History commands reply with a `command` field, not `message`
function request(socket, expectedCommand, message, fields = {}) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => fail(`no ${expectedCommand} reply within ${replyTimeoutMs} ms`), replyTimeoutMs);
        socket.onmessage = (event) => {
            const reply = JSON.parse(String(event.data));
            if (reply.command !== expectedCommand) return;
            clearTimeout(timer);
            resolve(reply);
        };
        socket.send(`json:${JSON.stringify({ message, ...fields })}`);
    });
}

function parseJson(label, content) {
    try {
        return JSON.parse(content);
    } catch (error) {
        fail(`${label} is not valid JSON: ${error.message}`);
    }
}

// 1. Connect: GPAC may still be starting
let socket;
while (!socket) {
    try {
        socket = await connect();
    } catch (error) {
        if (Date.now() > recordDeadline) fail(`no connection on port ${port}: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}

// 2. Wait for a session whose manifest is on disk (written at the first recorded event)
let recordedSession;
while (!recordedSession) {
    const reply = await request(socket, 'list_sessions', 'list_sessions');
    recordedSession = reply.sessions.find((session) => session.hasManifest);
    if (recordedSession) break;
    if (Date.now() > recordDeadline) fail(`no session with a manifest: ${JSON.stringify(reply.sessions)}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
}
console.log(`session ${recordedSession.sessionId}`);

// 3. session.json is the session root index: it lists the daily segments
const sessionReply = await request(socket, 'read_file', 'read_file', { sessionId: recordedSession.sessionId, file: 'session.json' });
if (sessionReply.status !== 'ok') fail(`session.json read failed: ${sessionReply.error} ${sessionReply.detail}`);
const sessionIndex = parseJson('session.json', sessionReply.content);
const firstSegment = sessionIndex.segments && sessionIndex.segments[0];
if (!firstSegment) fail(`session.json has no segment: ${sessionReply.content}`);

// 4. The manifest lives inside the segment directory, e.g. segments/0000/manifest.json
const manifestFile = `${firstSegment.dir}/manifest.json`;
const manifestReply = await request(socket, 'read_file', 'read_file', { sessionId: recordedSession.sessionId, file: manifestFile });
if (manifestReply.status !== 'ok') fail(`${manifestFile} read failed: ${manifestReply.error} ${manifestReply.detail}`);
const manifest = parseJson(manifestFile, manifestReply.content);
console.log(`manifest ${manifestFile} keys ${JSON.stringify(Object.keys(manifest).sort())}`);

socket.close();
process.exit(0);
