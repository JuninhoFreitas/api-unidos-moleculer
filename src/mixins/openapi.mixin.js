import OpenAPI from 'moleculer-auto-openapi';

const NODE_TYPES = {
	boolean: 'boolean',
	number: 'number',
	date: 'date',
	uuid: 'uuid',
	email: 'email',
	url: 'url',
	string: 'string',
	text: 'string',
	enum: 'enum',
	json: 'json',
};

OpenAPI.settings.openapi.components.schemas = {};
OpenAPI.actions.generateDocs.openapi.components.schemas = {};

OpenAPI.started = function() {
	this.logger.info(`📜 Docs are available at http://0.0.0.0:${this.settings.port}${this.settings.uiPath}`);
};

export default {
	mixins: [OpenAPI],

	methods: {

		// async fetchServicesWithActions() {
		//   let services = await this.broker.call("$node.services", {
		//     withActions: true,
		//     onlyLocal: this.settings.onlyLocal,
		//   });
		//   services = services
		//     .map(service => {
		//       if (isEmpty(service.settings.openapi)) {
		//         service.schema.settings.openapi = { enable: false }
		//       }
		//       return service
		//     })
		//     .filter(service => !isEmpty(service.settings))
		//     .filter(service => !isEmpty(service.settings.openapi))
		//     .filter(service => service.settings.openapi.enable)
		//   return services
		// },

		getTypeAndExample(node) {
			if (!node) {
				node = {};
			}
			let out = {};

			switch (node.type) {
				case NODE_TYPES.boolean:
					out = {
						type: 'boolean',
						example: false,
					};
					break;
				case NODE_TYPES.number:
					out = {
						type: 'number',
						example: 1,
					};
					break;
				case NODE_TYPES.date:
					out = {
						type: 'string',
						format: 'date-time',
						example: '1998-01-10T13:00:00.000Z',
					};
					break;
				case NODE_TYPES.uuid:
					out = {
						type: 'string',
						format: 'uuid',
						example: '10ba038e-48da-487b-96e8-8d3b99b6d18a',
					};
					break;
				case NODE_TYPES.email:
					out = {
						type: 'string',
						format: 'email',
						example: 'foo@example.com',
					};
					break;
				case NODE_TYPES.url:
					out = {
						type: 'string',
						format: 'uri',
						example: 'https://example.com',
					};
					break;
				case NODE_TYPES.enum:
					out = {
						type: 'string',
						enum: node.values,
						example: node.values ? node.values[0] : undefined,
					};
					break;
				default:
					out = {
						type: 'string',
						example: 'example',
					};
					break;
			}

			if (node.enum) {
				out.example = node.enum[0];
				out.enum = node.enum;
			}

			if (node.default) {
				out.default = node.default;
				delete out.example;
			}

			out.minLength = node.length || node.min;
			out.maxLength = node.length || node.max;

			/**
       * by DenisFerrero
       * @link https://github.com/grinat/moleculer-auto-openapi/issues/13
       */
			if (node.pattern && (node.pattern.length > 0 || node.pattern.source.length > 0)) {
				out.pattern = new RegExp(node.pattern).source;
			}

			return out;
		},
	},
};
