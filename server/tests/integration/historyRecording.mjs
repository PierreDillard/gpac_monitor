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

async function readSessionFile(file) {
    const reply = await request(socket, 'read_file', 'read_file', { sessionId: recordedSession.sessionId, file });
    if (reply.status !== 'ok') fail(`${file} read failed: ${reply.error} ${reply.detail}`);
    return reply.content;
}

// 3. session.json is the session root index: it lists the daily segments
const sessionIndex = parseJson('session.json', await readSessionFile('session.json'));
const firstSegment = sessionIndex.segments && sessionIndex.segments[0];
if (!firstSegment) fail(`session.json has no segment: ${JSON.stringify(sessionIndex)}`);

// 4. The manifest lives inside the segment directory, e.g. segments/0000/manifest.json
const segmentDir = `segments/${String(firstSegment.index).padStart(4, '0')}`;
const manifestFile = `${segmentDir}/manifest.json`;
let manifest = parseJson(manifestFile, await readSessionFile(manifestFile));
console.log(`manifest ${manifestFile} keys ${JSON.stringify(Object.keys(manifest).sort())}`);

// 5. eventChunks also lists the open chunk last: the first one is closed once there are two
const rotationStartMs = Date.now();
const rotationDeadline = rotationStartMs + 20000;
while (!(manifest.eventChunks && manifest.eventChunks.length >= 2)) {
    if (Date.now() > rotationDeadline) fail(`no closed chunk: ${JSON.stringify(manifest.eventChunks)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    manifest = parseJson(manifestFile, await readSessionFile(manifestFile));
}
const closedChunk = manifest.eventChunks[0];

// 6. Read the closed chunk the way the app does and check every event lies in its range
const chunkFile = `${segmentDir}/${closedChunk.file}`;
const events = (await readSessionFile(chunkFile))
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => parseJson(chunkFile, line));
const outOfRange = events.filter((event) => event.ts_us < closedChunk.fromUs || event.ts_us > closedChunk.toUs);
console.log(`chunk ${chunkFile} range [${closedChunk.fromUs}, ${closedChunk.toUs}] events ${events.length}/${closedChunk.count} waited ${Date.now() - rotationStartMs} ms`);
if (events.length === 0) fail(`${chunkFile} has no event`);
if (events.length !== closedChunk.count) fail(`${chunkFile} has ${events.length} events, manifest says ${closedChunk.count}`);
if (outOfRange.length > 0) fail(`${outOfRange.length} events outside the chunk range, first ts_us ${outOfRange[0].ts_us}`);

socket.close();
process.exit(0);
