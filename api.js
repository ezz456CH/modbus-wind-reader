const axios = require("axios");
const winddata = require("./data");

let windyapionce = false;

async function windyapi() {
    try {
        if (!windyapionce) {
            windyapionce = true;
        } else if (winddata.last_10m_sustained !== null && winddata.last_10m_gust !== null) {
            const data = {
                observations: [{ station: Number(process.env.WINDYSTATIONID), time: new Date().toISOString(), wind: winddata.sustained, gust: winddata.gust }],
            };
            const url = `https://stations.windy.com/pws/update/${process.env.WINDYAPIKEY}`;
            await axios.post(url, data);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString().red}] Failed to send data to windy:`, err);
    } finally {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const next = ((10 - (minutes % 10)) * 60 - seconds) * 1000;

        setTimeout(windyapi, next);
    }
}

module.exports = { windyapi };
