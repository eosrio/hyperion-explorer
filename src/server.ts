import {createNodeRequestHandler, isMainModule} from '@angular/ssr/node';
import {FastifyAngularSSR} from "./fastify-ssr";

declare const DEV_MODE: boolean;

console.log('DEV_MODE:', DEV_MODE, typeof DEV_MODE);

console.log(`Creating Fastify Server ${DEV_MODE}`);
const fastifyAngularSSR = new FastifyAngularSSR({
  port: parseInt(process.env["HYP_EXPLORER_PORT"] || '4200'),
  host: process.env["HYP_EXPLORER_HOST"] || '127.0.0.1',
  baseHref: DEV_MODE ? '/' : '/explorer'
});

// Start the server if this file is being run directly
if (isMainModule(import.meta.url) || process.env["HYP_EXPLORER_PORT"]) {
  await fastifyAngularSSR.start();
}

export const reqHandler = createNodeRequestHandler(async (req, res) => {
  await fastifyAngularSSR.fastify.ready();
  fastifyAngularSSR.fastify.server.emit('request', req, res);
  // console.log('Got request in Fastify:', req.url);
});
