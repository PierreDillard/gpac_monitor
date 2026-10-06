import { readFileSync } from 'node:fs';

const port = 6390;
const fixturePath = 'src/services/ws/__tests__/fixtures/monitor_config.json';
const connectDeadline = Date.now() + 15000;
const backendAttachMs = 2000;

function receiveMonitorConfig() {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`);
        const attachTimer = setTimeout(() => {
            socket.onerror = null;
            socket.close();
            reject(new Error(`no monitor_config within ${backendAttachMs} ms`));
        }, backendAttachMs);
        socket.onerror = () => {
            clearTimeout(attachTimer);
            reject(new Error('connection failed'));
        };
        socket.onmessage = (event) => {
            const message = JSON.parse(String(event.data));
            if (message.message !== 'monitor_config') return;
            clearTimeout(attachTimer);
            socket.onerror = null;
            socket.close();
            resolve(message);
        };
    });
}

function fail(reason) {
    console.error(reason);
    process.exit(1);
}

const fixtureKeys = [...Object.keys(JSON.parse(readFileSync(fixturePath, 'utf8'))), 'controlled_red'].sort();

while (true) {
    let monitorConfig;
    try {
        monitorConfig = await receiveMonitorConfig();
    } catch (error) {
        if (Date.now() > connectDeadline) fail(`no monitor_config on port ${port}: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
    }
    console.log(`gpac_version ${JSON.stringify(monitorConfig.gpac_version)}`);
    if (typeof monitorConfig.gpac_version !== 'string' || monitorConfig.gpac_version === '') {
        fail('gpac_version is not a non-empty string');
    }
    const realKeys = Object.keys(monitorConfig).sort();
    console.log(`keys ${JSON.stringify(realKeys)}`);
    if (JSON.stringify(realKeys) !== JSON.stringify(fixtureKeys)) {
        fail(`keys differ from fixture ${JSON.stringify(fixtureKeys)}`);
    }
    process.exit(0);
}
