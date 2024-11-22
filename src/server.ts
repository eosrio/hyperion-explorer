import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FastifyAngularSSR} from "./fastify-ssr";
import fastify from "fastify";

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use('/explorer', express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false
  }),
);

app.use('/**', (req, res, next) => {
  console.log(req.baseUrl);
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });

  const fastifyServer = fastify();
  const fastifyAngularSSR = new FastifyAngularSSR();

  fastifyServer.get('/*', async (req, reply) => {
    await fastifyAngularSSR.render(req, reply);
    return {};
  });

  try {
    await fastifyServer.listen({
      port: 3000,
      host: '0.0.0.0'
    });
    console.log(`Fastify server listening on http://localhost:3000`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

}

export const reqHandler = createNodeRequestHandler(app);
