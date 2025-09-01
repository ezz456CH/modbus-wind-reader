const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();
const colors = require("colors");
const fs = require("fs");

const { apipost } = require("./api");

require("dotenv").config();

const serialport = process.env.SERIALPORT || "/dev/ttyUSB0";
const baudrate = Number(process.env.BAUDRATE) || 4800;
const timeout = process.env.TIMEOUT || 2000;
const interval = process.env.INTERVAL || 1500;
const reconnectinterval = process.env.RECONNECTINTERVAL || 5000;

let isconnected = false;

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
        const data = await client.readHoldingRegisters(0, 10);
        const windspeedmps = data.data[0] * 0.1;
        const windspeedkmh = windspeedmps * 3.6;
        const windspeedmph = windspeedmps * 2.23694;

        const now = new Date().toISOString();

        if (process.env.ENABLEWINDSPEEDTERMINALLOG !== "false") {
            console.log(`[${now.red}] Latest Windspeed Reading: ${windspeedmps.toFixed(1).cyan} m/s (${windspeedkmh.toFixed(1).cyan} km/h, ${windspeedmph.toFixed(1).cyan} mph)`);
        }

        if (process.env.ENABLEWINDSPEEDLOGFILE !== "false") {
            const logfilename = `windspeed_${now.slice(0, 10)}.log`;

            const logEntry = {
                timestamp: now,
                windspeed_mps: windspeedmps.toFixed(1),
                windspeed_kmh: windspeedkmh.toFixed(1),
                windspeed_mph: windspeedmph.toFixed(1),
            };
            fs.appendFile(logfilename, JSON.stringify(logEntry) + "\n", (err) => {
                if (err) console.error(`[${now.red}] Failed to write log:`, err);
            });
        }

        if (process.env.ENABLEAPIPOST === "true") {
            const url = process.env.APIURL;
            const data = {
                timestamp: now,
                windspeed_mps: windspeedmps.toFixed(1),
            };
            await apipost(url, data);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString().red}] Read error:`, err);

        if (err.name === "PortNotOpenError") {
            isconnected = false;
            console.log(`[${new Date().toISOString().red}] Connection lost. Attempting to reconnect...`);
            setTimeout(connect, reconnectinterval);
        } else {
            console.warn(`[${new Date().toISOString().red}] Read error:`, err);
        }
    }
}

(async () => {
    await connect();
    setInterval(read, interval);
})();
