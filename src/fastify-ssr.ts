import fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {AngularNodeAppEngine, writeResponseToNodeResponse} from "@angular/ssr/node";
import fastifyStatic from "@fastify/static";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import fastifyCompress from "@fastify/compress";

interface FastifyAngularSSROptions {
  port?: number;
  host?: string;
}

export class FastifyAngularSSR {

  fastify: FastifyInstance = fastify();
  angularApp = new AngularNodeAppEngine();

  constructor(private options: FastifyAngularSSROptions) {
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
      prefix: '/explorer',
      wildcard: false,
      list: true,
      preCompressed: true
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
      console.log(`Fastify server listening on http://${host}:${port}`);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  }
}
