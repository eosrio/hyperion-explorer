import fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {AngularNodeAppEngine, writeResponseToNodeResponse} from "@angular/ssr/node";
import fastifyStatic from "@fastify/static";
import {dirname, resolve, join} from "node:path";
import {fileURLToPath} from "node:url";
import fastifyCompress from "@fastify/compress";
import {readFileSync} from "node:fs";
import {createContext, runInContext} from "node:vm";
import {readdirSync} from "fs";

interface FastifyAngularSSROptions {
  port?: number;
  host?: string;
  baseHref?: string;
}

async function readCustomTheme(file: string) {
  const themeSourceData = readFileSync(file).toString();
  // create VM context to run theme data
  const context = {themeData: {}};
  createContext(context);
  // run theme data in context
  runInContext(themeSourceData, context);
  return context.themeData;
}

export class FastifyAngularSSR {

  baseHref = '/explorer';
  fastify: FastifyInstance = fastify();
  angularApp = new AngularNodeAppEngine();

  constructor(private options: FastifyAngularSSROptions) {
    if (this.options.baseHref) {
      this.baseHref = this.options.baseHref;
    }
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

    this.fastify.get('/.internal/read_theme/:theme', async (req: FastifyRequest, reply: FastifyReply) => {
      const themeName = (req.params as any).theme as string;
      if (themeName) {
        const themeFile = resolve(serverDistFolder, `../../../themes/${themeName}.theme.mjs`);
        try {
          const themeData = await readCustomTheme(themeFile);
          reply.send(themeData);
        } catch (e) {
          reply.status(404).send(`Theme not found: ${themeName}`);
        }
      } else {
        reply.status(400).send('Theme name required');
      }
    });

    // Prevent SSR server handling hyperion API requests, this being called here is an error elsewhere
    this.fastify.get('/v2/*', async (req: FastifyRequest, reply: FastifyReply) => {
      console.log('Incoming request on:', req.url);
      console.error('API request detected, skipping SSR');
      reply.status(404).send('Not found');
    });

    this.fastify.get('/*', async (req: FastifyRequest, reply: FastifyReply) => {
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
