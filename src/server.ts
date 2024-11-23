import {createNodeRequestHandler, isMainModule} from '@angular/ssr/node';
import {FastifyAngularSSR} from "./fastify-ssr";

const fastifyAngularSSR = new FastifyAngularSSR({port: 4200, host: '127.0.0.1'});

if (isMainModule(import.meta.url)) {
  await fastifyAngularSSR.start();
}

export const reqHandler = createNodeRequestHandler(async (req, res) => {
  await fastifyAngularSSR.fastify.ready();
  fastifyAngularSSR.fastify.server.emit('request', req, res);
  console.log('Got request in Fastify:', req.url);
});
