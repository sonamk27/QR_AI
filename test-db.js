require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect()
  .then(() => {
    console.log("DATABASE CONNECTION SUCCESS");
    return client.query("SELECT NOW()");
  })
  .then((result) => {
    console.log(result.rows);
  })
  .catch((error) => {
    console.error("DATABASE CONNECTION FAILED");
    console.error(error.message);
  })
  .finally(() => {
    client.end();
  });