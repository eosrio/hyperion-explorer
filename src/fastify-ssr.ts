import {FastifyReply, FastifyRequest} from "fastify";
import {AngularNodeAppEngine} from "@angular/ssr/node";

export class FastifyAngularSSR {

  angularApp = new AngularNodeAppEngine();

  async render(req: FastifyRequest, reply: FastifyReply) {
    const url = req.url;
    console.log(url);
    const data = await this.angularApp.handle(req.raw);
    console.log(data);
  }
}
