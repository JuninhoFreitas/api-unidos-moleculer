import helmet from 'helmet';
import compression from 'compression';
import ApiService from 'moleculer-web';

const { PORT = '3000' } = process.env;

export default {
	name: 'api',
	mixins: [ApiService],

	settings: {
		etag: true,
		ip: '0.0.0.0',
		port: parseInt(PORT),

		rateLimit: {
			limit: 500,
			headers: true,
			window: 60 * 1000,
		},

		cors: {
			origin: '*',
			methods: [
				'DELETE',
				'GET',
				'HEAD',
				'OPTIONS',
				'PATCH',
				'POST',
				'PUT',
			],
		},

		use: [
			helmet(),
			compression(),

			function (err, req, res, next) {
				this.logger.error('Error is occured in middlewares!');
				this.sendError(req, res, err);
			},
		],

		routes: [
			{
				path: '/api',
				aliases: {
					'REST members-db': 'members-db',
					'POST members': 'members.register',
					'POST login': 'auth.login',
					'POST register': 'auth.register',
				},
			},
			{
				path: '/api',
				authorization: true,
				
				aliases: {
					'GET token': 'auth.resolveToken',
				},
				onBeforeCall(ctx, route, req, res) {
					this.logger.info("onBeforeCall in protected route");
					ctx.meta.authToken = req.headers["authorization"];
				},
			},
			{
				path: '/docs',
				aliases: {
					'GET /': 'openapi.ui',
					'GET /favicon.png': 'openapi.logo',
					'GET /assets/:file': 'openapi.assets',
					'GET /openapi.json': 'openapi.generateDocs',
				},

				onBeforeCall(ctx, route, req, res) {
					ctx.meta.$responseHeaders = {
						'Access-Control-Allow-Origin': '*',
						'Content-Security-Policy':
							"script-src-elem 'self' 'unsafe-inline' unpkg.com cdn.redoc.ly; object-src 'self' 'unsafe-inline'",
					};
				},
			},
			{
				path: '/',
				aliases: {
					'GET /': (req, res) => {
						res.writeHead(302, { Location: '/docs' });
						res.end();
					},
				},
			},
		],
	},
};
