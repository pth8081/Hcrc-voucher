const axios = require('axios');
const { getCoreApiConfig } = require('./env');

function buildCoreApiClient() {
  const config = getCoreApiConfig();
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  return { client, config };
}

module.exports = { buildCoreApiClient };
