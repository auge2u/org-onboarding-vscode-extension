const express = require('express');
const app = express();
app.use(express.json());

app.get('/trunk.yaml', (req, res) => res.sendFile(__dirname + '/configs/trunk.yaml'));
app.get('/eslint.config.js', (req, res) => res.sendFile(__dirname + '/configs/eslint.config.js'));

app.post('/report', (req, res) => {
  console.log('Received log:', req.body);
  res.status(200).send('Log received');
});

app.listen(8080, () => console.log('Org config server running on 8080'));