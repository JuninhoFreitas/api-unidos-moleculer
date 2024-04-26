import fs from 'fs'
import { join } from 'path'

import { fileDirName } from '../../concerns/file.js'
import OpenApiMixin from "../../mixins/openapi.mixin.js";
import pkg from "../../../package.json" assert { type: "json" };

export default {
  name: "openapi",
  mixins: [OpenApiMixin],

  dependencies: [
    'api',
    "members",
    "members-db",
    "auth"
  ],

  settings: {
    onlyLocal: true,
    collectOnlyFromWebServices: false,
    commonPathItemObjectResponses: true,

    uiPath: "/docs",
    assetsPath: "/docs/assets",
    schemaPath: "/docs/openapi.json",

    openapi: {
      info: {
        title: "api-unidos-moleculer",
        version: pkg.version,
        summary: pkg.description,

        description: [
          // https://docs.stoplight.io/docs/platform/b591e6d161539-stoplight-flavored-markdown-smd
          fs.readFileSync(join(fileDirName(import.meta).__dirname, '..', '..', 'concerns', 'assets', 'introduction.md')),
          '## Topologia',
          fs.readFileSync(join(fileDirName(import.meta).__dirname, '..', '..', 'concerns', 'assets', 'ecosystem.md')),
        ].join('\n\n\n'),
      },

      servers: [
        {
          description: "LOC",
          url: `http://localhost:3000`,
        },
      ],
    },
  },

  actions: {
    redirectToDocs: {
      async handler(ctx) {
        ctx.meta.$statusCode = 302;
        ctx.meta.$location = "/docs";
        return;
      }
    },

    async ui(ctx) {
      ctx.meta.$responseType = "text/html; charset=utf-8";

      ctx.meta.$responseHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Security-Policy": "script-src-elem 'self' unpkg.com cdn.redoc.ly; object-src 'self'",
      };

      const filename = join(fileDirName(import.meta).__dirname, '..', '..', 'concerns', 'stoplight.html')
      const template = fs.readFileSync(filename)

      return template;
    },

    async logo(ctx) {
      ctx.meta.$responseType = "Content-Type:image/*; charset=utf-8";

      ctx.meta.$responseHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Security-Policy": "script-src-elem 'self' unpkg.com cdn.redoc.ly; object-src 'self'",
      };

      const filename = join(fileDirName(import.meta).__dirname, '..', '..', 'concerns', 'logo.png')
      const image = fs.readFileSync(filename)

      return image;
    },
  },
};
