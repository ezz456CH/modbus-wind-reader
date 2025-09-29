const fs = require("fs");
const WebSocket = require("ws");
const winddata = require("./data");
const { randomUUID } = require("crypto");

function ws() {
    const url = process.env.WSURL;

    if (!url) {
        console.error(`[${new Date().toISOString().red}] WSURL is not defined in .env!`);
        return;
    }

    const uuidfile = "uuid";
    let uuid;

    if (!fs.existsSync(uuidfile) || fs.readFileSync(uuidfile, "utf8").trim() === "") {
        uuid = randomUUID();
        fs.writeFileSync(uuidfile, uuid, "utf8");
        console.log(`[${new Date().toISOString().red}] Generated new UUID: ${uuid}`);
    } else {
        uuid = fs.readFileSync(uuidfile, "utf8").trim();
        console.log(`[${new Date().toISOString().red}] Loaded existing UUID: ${uuid}`);
    }

    let socket;

    function connect() {
        socket = new WebSocket(url);

        socket.on("open", () => {
            console.log(`[${new Date().toISOString().red}] Connected to: ${url}`);
        });

        let sendinterval = null;

        socket.on("message", (msg) => {
            const data = JSON.parse(msg.toString());

            if (data.action === "identify") {
                socket.send(JSON.stringify({ uuid, station: process.env.WSSTATIONNAME || "-" }));
            }

            if (data.action === "registered") {
                if (sendinterval) {
                    clearTimeout(sendinterval);
                    sendinterval = null;
                }

                function senddata() {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify(winddata));
                    }
                    sendinterval = setTimeout(senddata, 1000);
                }

                senddata();
            }
        });

        socket.on("close", () => {
            console.warn(`[${new Date().toISOString().red}] Disconnected from: ${url}`);
            if (sendinterval) {
                clearTimeout(sendinterval);
                sendinterval = null;
            }
            setTimeout(connect, 3000);
        });

        socket.on("error", (err) => {
            console.error(`[${new Date().toISOString().red}] WebSocket error:`, err);
            socket.close();
        });
    }

    connect();
}

module.exports = { ws };
