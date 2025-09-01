const axios = require("axios");

async function apipost(url, data) {
    try {
        await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${process.env.APITOKEN}`
            },
        });
    } catch (error) {
        console.error(`[${new Date().toISOString().red}] Error posting data: ${error}`);
    }
}

module.exports = { apipost };
