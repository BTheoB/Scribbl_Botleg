import express from 'express';

const defaultRouteur = express.Router();

import path from "path";

const DIST_DIR = path.join(__dirname, "../../../client/dist");

const HTML_FILE = path.join(DIST_DIR, "index.html");

defaultRouteur.use(express.static(DIST_DIR));

defaultRouteur.get('/', (request, response) => {
  process.stdout.write('Lechemin\n');
  console.log('object ²:>> ');
  process.stdout.write(HTML_FILE);
  response.sendFile(HTML_FILE);
});

export {
    defaultRouteur as DefaultRouteur
};
