import got from 'got'
import { merge, pick } from 'lodash-es'

import pkg from "../../package.json" assert { type: "json" };

export default {
  settings: {
    debug: false,

    http: {
      auth: true,
      basicToken: '',

      proxy: {
        replaceStrFromUrl: '',
      },

      clientSettings: {
        prefixUrl: 'https://some-proxy.com',
        headers: {
          "user-agent": `${pkg.name}/${pkg.version}`,
        },
      },
    }
  },

  created() {
    const { auth, clientSettings, basicToken } = this.settings.http

    if (auth && !basicToken) throw new Error('Missing API token')

    this.currentToken = 0
    this.tokens = basicToken.split(',')

    if (this.tokens.length > 0) this.logger.info(`Using ${this.tokens.length} tokens`)
    const credentials = Buffer.from(`${this.tokens[this.currentToken]}:`).toString('base64')

    this.client = got.extend(merge(clientSettings, {
      headers: {
        "authorization": `Basic ${credentials}`,
      },

      hooks: {
        beforeRequest: [
          (options) => this.logger.info(` 💻  >>  ${options.method} ${options.url} t=${this.currentToken}`),
        ],

        afterResponse: [
          (response) => {
            this.logger.info(` 💻  <<  ${response.statusCode} (${response.rawBody.length} bytes)`)
            return { ...response }
          },
        ],

        beforeError: [
          (error) => {
            const { response } = error;
            error.statusCode = response.statusCode;

            if (response && response.body) error.body = JSON.parse(response.body)

            if (error.statusCode === 404) error.name = 'NotFound';
            else if (error.statusCode === 429) error.name = 'RateLimited';

            return error;
          },
        ]
      },
    }))
  },

  hooks: {
    before: {
      send: [
        async function (ctx) {
          const credentials = Buffer.from(`${this.settings.http.basicToken}:`).toString('base64')

          if (!ctx.params.headers) ctx.params.headers = {}
          ctx.params.headers['authorization'] = `Basic ${credentials}`
        }
      ],
    }
  },

  actions: {
    middleware: {
      cache: false,

      params: {
        req: 'object',
        res: 'object',
      },

      async handler(ctx) {
        const { req, res } = ctx.params
        const { replaceStrFromUrl } = this.settings.http.proxy

        const config = {
          query: { ...req.query },
          method: req.method.toLowerCase(),
          url: req.parsedUrl.replace(replaceStrFromUrl, ''),
        }

        if (['patch', 'put', 'post'].includes(config.method)) config.body = req.body

        try {
          const clientResponse = await this.actions.send(config, { parentCtx: ctx })

          res.writeHead(clientResponse.statusCode, pick(clientResponse.headers, [
            'date',
            'content-type',
            'x-request-id',
            'x-ratelimit-limit',
            'x-ratelimit-remaining',
          ]))

          const response = JSON.stringify({
            status: clientResponse.statusCode,
            data: JSON.parse(new String(clientResponse.body))
          })

          res.write(response)
        } catch (error) {
          res.writeHead(error.statusCode || 500, {})

          res.write(JSON.stringify({
            name: error.name,
            status: error.statusCode || 500,
            message: error.message,
            data: error.body,
          }))
        }

        return res.end()
      }
    },

    proxy: {
      cache: true,

      async handler(ctx) {
        const {
          body,
          query,
          url,
          method = 'get',
        } = ctx.params

        const config = {
          url,
          query,
          method: method.toLowerCase(),
        }

        if (['patch', 'put', 'post'].includes(config.method)) config.body = body

        try {
          const clientResponse = await this.actions.send(config, { parentCtx: ctx })

          const response = {
            status: clientResponse.statusCode,
            data: JSON.parse(clientResponse.body)
          }

          return [null, response]
        } catch (error) {
          this.logger.error(error)
          return [error, {}]
        }
      }
    },

    send: {
      cache: true,

      params: {
        method: 'string|default:get',
        url: 'string',
        headers: 'object|optional',
        query: 'object|optional',
        body: ['object|optional', 'string|optional'],
      },

      async handler(ctx) {
        const { method, url, headers, query, body } = ctx.params

        const config = {
          headers,
          searchParams: query,
        }

        if (body) config.json = body
        if (query) config.searchParams = query

        let response = await this.client[method](url, config)
        response = pick(response, ['url', 'ip', 'ok', 'body', 'timings', 'headers', 'statusCode'])

        return response
      }
    },
  }
}