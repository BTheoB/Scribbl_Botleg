import express from 'express';
import { HelloRouteur } from './routes/hello.router';
import { DefaultRouteur } from './routes/default.router';
import { PeerServer } from "peer";
import cors from 'cors';

const app = express();
const port = 3004;


//app.use(cors());

const peerServer = PeerServer(
  { 
    port: 9000,
  }
);
peerServer.on('connection', (client) => { console.log("client : ", client.getId()); });

peerServer.on('message', (client, message) => {
  console.log(`Received message from client ${client.getId()}:`, message);
});

app.listen(port, () => {
  process.stdout.write(`Server started on port: ${port}\n`);
});

app.use('/hello', HelloRouteur);
app.use('/', DefaultRouteur);

