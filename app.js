const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

const DATA_FILE = 'global.json';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const MAX_JSON_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

const MAX_DB_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB in bytes
// Example maximum database size in bytes, adjust as needed

// Middleware for parsing JSON body
app.use(express.json({ limit: '5mb' }));

const readData = () => {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return {};
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const removeInactiveUsers = () => {
  const data = readData();
  const now = Date.now();
  let modified = false;

  Object.keys(data).forEach(userId => {
    if (data[userId].timeRemove <= now) {
      delete data[userId];
      modified = true;
    }
  });

  if (modified) {
    writeData(data);
  }
};

const getFileSizeInBytes = (filename) => {
  const stats = fs.statSync(filename);
  return stats.size;
};

const getRemainingDbSpace = (usedSize) => {
  return MAX_DB_SIZE - usedSize;
};

// Middleware to check and remove inactive users
app.use((req, res, next) => {
  removeInactiveUsers();
  next();
});

app.get('/dbinfo', (req, res) => {
  const usedSize = getFileSizeInBytes(DATA_FILE);
  const remainingSize = getRemainingDbSpace(usedSize);

  const usedSizeMB = usedSize / (1024 * 1024);
  const remainingSizeMB = remainingSize / (1024 * 1024);
  const maxDbSizeMB = MAX_DB_SIZE / (1024 * 1024);
  res.send(`
    <p>Database Size Information:</p>
    <ul>
      <li>Used Size: ${usedSizeMB.toFixed(2)} MB</li>
      <li>Remaining Size: ${remainingSizeMB.toFixed(2)} MB</li>
      <li>Maximum Size: ${maxDbSizeMB.toFixed(2)} MB</li>
    </ul>
  `);
});

app.post('/write/:userId', (req, res) => {
  const { userId } = req.params;
  const json = req.body.json;

  if (!json) {
    return res.status(400).send('Missing json body parameter');
  }

  const dataSize = Buffer.byteLength(JSON.stringify(json), 'utf8');

  if (dataSize > MAX_JSON_SIZE) {
    return res.status(400).send(`JSON size exceeds the maximum limit of 5 MB`);
  }

  const data = readData();
  const now = Date.now();
  data[userId] = {
    timeRemove: now + THIRTY_DAYS_MS,
    data: json
  };
  writeData(data);

  res.send(`Data for user ${userId} has been written`);
});

app.get('/read/:userId', (req, res) => {
  const { userId } = req.params;
  const data = readData();
  const now = Date.now();

  if (data[userId]) {
    // Reset removal time
    data[userId].timeRemove = now + THIRTY_DAYS_MS;
    writeData(data);
    res.json(data[userId].data);
  } else {
    res.json({});
  }
});

app.get('/delete/:userId', (req, res) => {
  const { userId } = req.params;
  const data = readData();

  if (data[userId]) {
    delete data[userId];
    writeData(data);
    res.send(`Data for user ${userId} has been deleted`);
  } else {
    res.status(404).send(`No data found for user ${userId}`);
  }
});

app.get('/', (req, res) => {
  res.send(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.7.2/styles/dark.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.7.2/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    <title>API Documentation</title>
    <style>
      body {
        background-color: #121212;
        color: #ffffff;
      }
      .container {
        margin-top: 50px;
      }
      pre {
        background-color: #1e1e1e;
        padding: 10px;
        border-radius: 5px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="mb-4">API Documentation</h1>
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /write/:userId</code> - Writes data for a user (Max 5 MB JSON)</li>
        <li><code>GET /read/:userId</code> - Reads data for a user</li>
        <li><code>GET /delete/:userId</code> - Deletes data for a user</li>
        <li><code>GET /</code> - API Documentation</li>
        <li><code>GET /dbinfo</code> - Shows database size information</li>
      </ul>
      <h2>Examples</h2>
      <h3>Python</h3>
      <pre><code class="language-python">
import requests

# Write data
response = requests.post('http://nue-db.koyeb.app/write/user1', json={"json": {"key": "value"}})
print(response.text)

# Read data
response = requests.get('http://nue-db.koyeb.app/read/user1')
print(response.json())

# Delete data
response = requests.get('http://nue-db.koyeb.app/delete/user1')
print(response.text)

# DB Info
response = requests.get('http://nue-db.koyeb.app/dbinfo')
print(response.json())
      </code></pre>
      <h3>Node.js with Axios</h3>
      <pre><code class="language-javascript">
const axios = require('axios');

axios.post('http://nue-db.koyeb.app/write/user1', {
  json: { key: 'value' }
}).then(response => {
  console.log(response.data);
});

axios.get('http://nue-db.koyeb.app/read/user1')
  .then(response => {
    console.log(response.data);
  });

axios.get('http://nue-db.koyeb.app/delete/user1')
  .then(response => {
    console.log(response.data);
  });

axios.get('http://nue-db.koyeb.app/dbinfo')
  .then(response => {
    console.log(response.data);
  });
      </code></pre>
      <h3>cURL</h3>
      <pre><code class="language-bash">
# Write data
curl -X POST -H "Content-Type: application/json" -d '{"json":{"key":"value"}}' "http://nue-db.koyeb.app/write/user1"

# Read data
curl "http://nue-db.koyeb.app/read/user1"

# Delete data
curl "http://nue-db.koyeb.app/delete/user1"

# DB Info
curl "http://nue-db.koyeb.app/dbinfo"
      </code></pre>
      <h3>Example Responses</h3>
      <pre><code class="language-json">
# Response for writing data
"Data for user user1 has been written"

# Response for reading data
{
  "key": "value"
}

# Response for deleting data
"Data for user user1 has been deleted"

# Error response for missing JSON body parameter
"Missing json body parameter"

# Error response for non-existent user data
"No data found for user user1"

# Response for DB info
{
  "usedSize": 12345,
  "remainingSize": 52428800,
  "maxDbSize": 52428800
}
      </code></pre>
    </div>
  </body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`Server is running at http://nue-db.koyeb.app`);
});