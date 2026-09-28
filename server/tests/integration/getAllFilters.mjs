const port = 6390;
const expectedFilters = ['avgen', 'reframer', 'inspect'];
const connectDeadline = Date.now() + 15000;
const backendAttachMs = 2000;

function queryFilterNames() {
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
            if (message.message === 'monitor_config') {
                clearTimeout(attachTimer);
                console.log(`gpac ${message.gpac_version}`);
                socket.send(`json:${JSON.stringify({ message: 'get_all_filters' })}`);
                return;
            }
            if (message.message !== 'filters') return;
            socket.onerror = null;
            socket.close();
            resolve(message.filters.map((filter) => filter.name));
        };
    });
}

while (true) {
    try {
        const filterNames = await queryFilterNames();
        console.log(`filters ${JSON.stringify(filterNames)}`);
        const missingFilters = expectedFilters.filter((name) => !filterNames.includes(name));
        if (missingFilters.length > 0) {
            console.error(`missing filters: ${missingFilters.join(', ')}`);
            process.exit(1);
        }
        process.exit(0);
    } catch (error) {
        if (Date.now() > connectDeadline) {
            console.error(`no filters reply on port ${port}: ${error.message}`);
            process.exit(1);
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}
