import fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {AngularNodeAppEngine, writeResponseToNodeResponse} from "@angular/ssr/node";
import fastifyStatic from "@fastify/static";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import fastifyCompress from "@fastify/compress";

interface FastifyAngularSSROptions {
  port?: number;
  host?: string;
  baseHref?: string;
}

export class FastifyAngularSSR {

  baseHref = '/explorer';
  fastify: FastifyInstance = fastify();
  angularApp = new AngularNodeAppEngine();

  constructor(private options: FastifyAngularSSROptions) {
    if (this.options.baseHref) {
      this.baseHref = this.options.baseHref;
    }
    console.log('Base href:', this.baseHref);
    this.setup();
  }

  setup() {

    const serverDistFolder = dirname(fileURLToPath(import.meta.url));
    const browserDistFolder = resolve(serverDistFolder, '../browser');

    this.fastify.register(fastifyCompress, {global: true});

    this.fastify.register(fastifyStatic, {
      root: browserDistFolder,
      redirect: false,
      index: false,
      prefix: this.baseHref,
      wildcard: false,
      list: true,
      preCompressed: false
    });

    // Prevent SSR server handling hyperion API requests, this being called here is an error elsewhere
    this.fastify.get('/v2/*', async (req: FastifyRequest, reply: FastifyReply) => {
      console.log('Incoming request on:', req.url);
      console.log('API request detected, skipping SSR');
      reply.status(404).send('Not found');
    });

    this.fastify.get('/*', async (req: FastifyRequest, reply: FastifyReply) => {
      console.log('Incoming request on:', req.url);
      const data = await this.angularApp.handle(req.raw);
      if (data) {
        // stream the response to fastify
        await writeResponseToNodeResponse(data, reply.raw);
      } else {
        reply.status(404).send('Not found');
      }
    });
  }

  async start() {
    try {
      const host = this.options.host || 'localhost';
      const port = this.options.port || 3000;
      await this.fastify.listen({port, host});
      const protocol = 'http';
      const url = `${protocol}://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}${this.baseHref}`;
      console.log(`Fastify server listening on [${host}] - ${url}`);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
}
