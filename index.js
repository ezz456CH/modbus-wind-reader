const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const fs = require("fs");

const { apipost, windyapi } = require("./api");
const winddata = require("./winddata");

require("colors");
require("dotenv").config();

const serialport = process.env.SERIALPORT || "/dev/ttyUSB0";
const baudrate = Number(process.env.BAUDRATE) || 4800;
const timeout = process.env.TIMEOUT || 2000;
const interval = process.env.INTERVAL || 1000;
const reconnectinterval = process.env.RECONNECTINTERVAL || 5000;

let isconnected = false;

let wind_cache = [];

let loggedonce = false;

async function winddatacache(data) {
    const now = Date.now();

    wind_cache.push(data);

    wind_cache = wind_cache.filter((d) => now - new Date(d.timestamp).getTime() <= 10 * 60 * 1000);

    let sustained = null;
    let gust = null;

    if (wind_cache.length === 0) {
        winddata.sustained = null;
        winddata.gust = null;
        return;
    }

    const sustained_speeds = wind_cache.map((d) => d.windspeed_mps);
    sustained = sustained_speeds.reduce((a, b) => a + b, 0) / sustained_speeds.length;

    let maxgust = 0;

    for (let i = 0; i < wind_cache.length; i++) {
        let segmentmax = wind_cache[i].windspeed_mps;
        let starttime = new Date(wind_cache[i].timestamp).getTime();
        let lasttime = starttime;

        for (let j = i + 1; j < wind_cache.length; j++) {
            const current = new Date(wind_cache[j].timestamp).getTime();
            const delta = (current - lasttime) / 1000;
            if (delta > 2) break;

            segmentmax = Math.max(segmentmax, wind_cache[j].windspeed_mps);
            lasttime = current;

            const elapsed = (lasttime - starttime) / 1000;
            if (elapsed >= 3) maxgust = Math.max(maxgust, segmentmax);
            if (elapsed > 20) break;
        }
    }

    gust = maxgust;

    sustained = parseFloat(sustained.toFixed(1));
    gust = parseFloat(gust.toFixed(1));

    winddata.sustained = sustained;
    winddata.gust = gust;
}

async function connect() {
    try {
        await client.connectRTUBuffered(serialport, { baudRate: baudrate });
        client.setID(1);
        client.setTimeout(timeout);
        isconnected = true;
        console.log(`[${new Date().toISOString().red}] Connected to serial port: ${serialport.cyan}`);
        console.log(`[${new Date().toISOString().red}] Configuration - Baudrate: ${baudrate.toString().cyan} bps, Timeout: ${timeout.toString().cyan} ms, Interval: ${interval.toString().cyan} ms`);
    } catch (err) {
        isconnected = false;
        console.error(`[${new Date().toISOString().red}] Connection error. will retry in ${reconnectinterval / 1000}s:`);
        console.error(`[${new Date().toISOString().red}]`, err);
        setTimeout(connect, reconnectinterval);
    }
}

async function read() {
    if (!isconnected) return;

    try {
        const regs = await client.readHoldingRegisters(0, 10);
        const windspeedmps = regs.data[0] * 0.1;

        const now = new Date().toISOString();

        const data = {
            timestamp: now,
            windspeed_mps: windspeedmps,
            last_10m_sustained: winddata.sustained,
            last_10m_gust: winddata.gust,
        };

        await winddatacache(data);

        if (process.env.ENABLEWINDSPEEDLOGFILE !== "false") {
            const logfilename = `windspeed_${now.slice(0, 10)}.log`;

            fs.appendFile(logfilename, JSON.stringify(data) + "\n", (err) => {
                if (err) console.error(`[${now.red}] Failed to write log:`, err);
            });
        }

        if (process.env.ENABLEAPIPOST === "true") {
            const url = process.env.APIURL;
            await apipost(url, data);
        }

        setTimeout(read, interval);
    } catch (err) {
        console.error(`[${new Date().toISOString().red}] Read error:`, err);

        if (err.name === "PortNotOpenError") {
            isconnected = false;
            console.log(`[${new Date().toISOString().red}] Connection lost. Attempting to reconnect...`);
            setTimeout(connect, reconnectinterval);
        } else {
            console.warn(`[${new Date().toISOString().red}] Read error:`, err);
        }

        setTimeout(read, interval);
    }
}

function terminallog() {
    const now = new Date();
    if (!loggedonce) {
        loggedonce = true;
    } else {
        console.log(`[${now.toISOString().red}] Last 10 Mins Sustained: ${winddata.sustained.toFixed(1).cyan} m/s | Last 10 Mins Gust: ${winddata.gust.toFixed(1).cyan} m/s`);
    }

    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const next = ((10 - (minutes % 10)) * 60 - seconds) * 1000;

    setTimeout(terminallog, next);
}

(async () => {
    await connect();
    await read();
    if (process.env.ENABLEWINDSPEEDTERMINALLOG !== "false") {
        terminallog();
    }
    if (process.env.ENABLEWINDYAPI !== "false") {
        windyapi();
    }
})();
