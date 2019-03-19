const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Chatkit = require('@pusher/chatkit-server');

const app = express();
    const instance_locator_id = '0c189a30-bee2-488b-a6db-6797b29c25f2';
    const chatkit_secret = 'e915cd0f-a4d7-4907-acd3-e2302690621d:KEQd1PghotbBOL+PDJ3gpYsAUQM4hPzjbENOU1ZpbPY=';

    const chatkit = new Chatkit.default({
      instanceLocator: `v1:us1:${instance_locator_id}`,
      key: chatkit_secret,
    });

    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(cors());

    app.get('/', (req, res) => {
        res.send('all green!');
      });
    app.get('/users', (req, res) => {
      res.send(console.log(res));
      })
      app.post('/users', (req, res) => {
        const { username } = req.body;
  
        chatkit
          .createUser({
            id: username,
            name: username,
          })
          .then(() => {
            res.sendStatus(201);
          })
          .catch((error) => {
            if (error.error === 'services/chatkit/user_already_exists') {
              res.sendStatus(200);
            } else {
              let statusCode = error.status;
              if (statusCode >= 100 && statusCode < 600) {
                res.status(statusCode);
              } else {
                res.status(500);
              }
            }
          });
      });
      const PORT = 3000;
      app.listen(PORT, (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log(`Running on ports ${PORT}`);
        }
      });