import Amqp from 'amqplib';
import { CronJob } from 'cron';
import { Errors } from 'moleculer';
import { forIn, isFunction, isObject, merge } from 'lodash-es';

const {
	RABBITMQ_PREFETCH = '3',
	RABBITMQ_CONNECTION_STRING,
	RABBITMQ_ASSERT_QUEUE = 'true',
	RABBITMQ_ASSERT_EXCHANGE = 'true',
} = process.env;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default {
	settings: {
		amqp: {
			maxRetries: null, // null to infinite
			retryInterval: 2000, // ms (unit)
			maxConnections: null,
			connectionString: RABBITMQ_CONNECTION_STRING,

			client: {
				namespacePrefix: true,
				options: {
					clientProperties: {
						connection_name: '{service}',
					}
				}
			},

			channels: {
				prefetch: parseInt(RABBITMQ_PREFETCH),
				consume: {
					noAck: false,
				}
			},

			exchange: {
				name: null,
				type: 'direct',
				assert: new Boolean(RABBITMQ_ASSERT_EXCHANGE),
				config: {}
			},

			queues: {
				prefix: '',
				assert: new Boolean(RABBITMQ_ASSERT_QUEUE),
				config: {
					durable: true
				},
			},

			messages: {
				persistent: false,
			},

			queuesReporter: {
				enabled: true,
				print: false,
				cron: '*/20 * * * * *',
				handler: async (queues, report) => { },
			}
		},
	},

	created() {
		this.$queues = [];
		this.$channels = {};
		this.$channel = null;
		this.$connection = null;
	},

	async started() {
		const { connectionString, queuesReporter } = this.settings.amqp;
		if (!connectionString) throw new Errors.ServiceSchemaError('Missing [amqp.connectionString] on settings.');

		try {
			await this.connect();
		} catch (err) {
			throw new Errors.MoleculerError('Unable to connect to AMQP.', err);
		}

		await this.setupQueues();
		await this.startConsumers();

		if (queuesReporter.enabled) {
			await this.startReporter();
		}
	},

	async stopped() {
		try {
			if (this.$channel) {
				await this.$channel.close();
			}
			if (this.$connection) {
				await this.$connection.disconnect();
				await this.$connection.close();
			}
		} catch (e) {
			this.logger.warn('Unable to stop database connection gracefully.', e);
		}

		if (this.$reporter) {
			this.$reporter.stop();
			delete this.$reporter;
		}
	},

	actions: {

		sendMessage: {
			cache: false,

			params: {
				queue: 'string|optional',
				body: ['object', 'string'],
				routingKey: 'string|optional',
			},

			async handler(ctx) {
				const { queue, routingKey } = ctx.params;

				if ([queue, routingKey].filter(x => x).length < 1) {
					throw new Errors.MoleculerError('Missing queue or routingKey');
				}

				return this.sendMessage(ctx.params);
			},
		},

		getQueue: {
			cache: false,

			params: {
				name: 'string',
			},

			async handler(ctx) {
				return this.$queues.find(q => q.name === ctx.params.name);
			},
		}
	},

	methods: {

		async connect() {
			const {
				client,
				maxRetries,
				retryInterval,
				connectionString,
			} = this.settings.amqp;

			client.options.clientProperties.connection_name = (client.namespacePrefix && this.broker.namespace)
				? '{namespace}__' + client.options.clientProperties.connection_name
				: 'mol_' + client.options.clientProperties.connection_name;

			client.options.clientProperties.connection_name = client.options.clientProperties.connection_name
				.replace('{namespace}', this.broker.namespace)
				.replace('{service}', this.name);

			await new Promise((resolve, reject) => {
				let i = 1;

				const loop = setInterval(async () => {
					this.logger.info(`Connecting... Try #${i++}...`);

					try {
						this.$connection = await Amqp.connect(connectionString, client.options);
						resolve();
						clearInterval(loop);
					} catch (error) {
						this.logger.error('Connection error while connecting...', error);
						this.logger.warn(`Connecting... Try #${i + 1} failed! Retrying in ${retryInterval}ms...`);
					}

					if (maxRetries && i > maxRetries) {
						this.logger.error('Max retries reached. Unable to connect to AMQP.');
						reject();
						clearInterval(loop);
					}
				}, retryInterval);
			});

			process.once('SIGINT', this.$connection.close.bind(this.$connection));

			this.$connection.on('error', (err) => this.logger.error(`Connection ${this.name} #error:`, err));
			this.$connection.on('close', async () => {
				this.logger.warn(`Connection ${this.name} #closed.`);
				wait(retryInterval).then(() => this.reconnect());
			});

			const { cluster_name, version } = this.$connection.connection.serverProperties;
			this.logger.info(`Connected to ${cluster_name} (v${version})`);

			// default channel
			this.$channel = await this.createChannel('maintenance');
			this.$channel.on('close', async () => {
				delete this.$channel;
				this.$channel = await this.createChannel('maintenance');
			});
		},

		async reconnect() {
			this.logger.warn('Reconnecting...');

			try {
				await this.$connection.close();
			} catch (error) {
				delete this.$connection;
			}

			await this.connect();
			await this.startConsumers();
		},

		async setupQueues() {
			const { exchange: exchangeConfig } = this.settings.amqp;

			if ([true, 'true'].includes(exchangeConfig.assert)) {
				await this.assertExchange(exchangeConfig);
			}

			if (this.schema.queues) {
				forIn(this.schema.queues, async (funOrObj, name) => {
					const def = this.createQueueDefinition(name, funOrObj);
					this.$queues.push(def);

					const problemAtCreating = await this.assertQueue(def);
					// if (problemAtCreating) def.active = false

					await this.bindQueueToExchange(def.name, exchangeConfig.name, def.routingKey);

				});
			}
		},

		createQueueDefinition(name, userDef) {
			const { channels, queues: queuesConfig } = this.settings.amqp;
			const fullname = (queuesConfig.prefix || '') + name;

			const def = merge(
				{
					config: {},
					active: true,
					name: fullname,
					routingKey: fullname,
					prefetch: channels.prefetch,
					handler: async (channel, msg) => { },
				},
				{ ...queuesConfig },
				isFunction(userDef) ? { handler: userDef } : userDef
			);

			def.active = [true, 'true'].includes(def.active);
			return def;
		},

		async createChannel(name = null, withListeners = true) {
			const channel = await this.$connection.createChannel();

			if (withListeners) {
				channel.on('close', () => this.logger.trace(`Channel [${this.name}]${name ? '.' + name : ''} closed.`));
				channel.on('error', (err) => this.logger.error(`Channel [${this.name}]${name ? '.' + name : ''} got error:`, err));
				channel.on('blocked', (reason) => this.logger.warn(`Channel [${this.name}]${name ? '.' + name : ''} blocked for:`, reason));
				channel.on('unblocked', () => this.logger.warn(`Channel [${this.name}]${name ? '.' + name : ''} unblocked!`));
			}

			return channel;
		},

		async assertExchange({ name, type = 'topic', config = {} }) {
			let recriate = false;
			const channelName = `exchange-assert-${name}`;
			let channel = await this.createChannel(channelName);

			try {
				this.logger.trace(`Checking exchange ${name}...`);
				await channel.checkExchange(name);
				this.logger.trace(`Checking exchange ${name}... Ok!`);
			} catch (err) {
				this.logger.trace(`Exchange ${name} does not exist. Creating...`, err);
				channel = await this.createChannel(channelName);
			}

			try {
				this.logger.trace(`Asserting exchange ${name}...`);
				await channel.assertExchange(name, type, config);
				this.logger.trace(`Asserting exchange ${name}... Ok!`);
			} catch (err) {
				this.logger.trace(`Exchange ${name} is imcompatible with current settings!`, err);
				channel = await this.createChannel(channelName);
				recriate = true;
			}

			if (recriate) {
				try {
					this.logger.trace(`Deleting and recreating exchange ${name}...`);
					await channel.deleteExchange(name);
					await channel.assertExchange(name, type, config);
					this.logger.trace(`Deleting and recreating exchange ${name}... Ok!`);
				} catch (error) {
					this.logger.error(`Nothing worked for exchange ${name}.`, err);
				}
			}

			await channel.close();
		},

		async assertQueue({ name, config = {} }) {
			let recriated = false;
			let problemAtCreating = false;

			const channelName = `queue-assert-${name}`;
			let channel = await this.createChannel(channelName);

			try {
				this.logger.trace(`Checking queue ${name}...`);
				await channel.checkQueue(name);
				this.logger.trace(`Checking queue ${name}... Ok!`);
			} catch (err) {
				this.logger.trace(`Queue ${name} does not exist. Creating...`, err);
				channel = await this.createChannel(channelName);
			}

			try {
				this.logger.trace(`Asserting queue ${name}...`);
				await channel.assertQueue(name, config);
				this.logger.trace(`Asserting queue ${name}... Ok!`);
			} catch (err) {
				this.logger.trace(`Queue ${name} is imcompatible with current settings!`, err);
				channel = await this.createChannel(channelName);
				recriated = true;
			}

			if (recriated) {
				try {
					this.logger.trace(`Deleting and recreating queue ${name}...`);
					await channel.purgeQueue(name);
					await channel.deleteQueue(name);
					await channel.assertQueue(name, config);
					this.logger.trace(`Deleting and recreating queue ${name}... Ok!`);
				} catch (err) {
					this.logger.error(`Nothing worked for the queue ${name}.`, err);
					problemAtCreating = true;
				}
			}

			await channel.close();
			return problemAtCreating;
		},

		async bindQueueToExchange(name, exchange, routingKey = null) {
			try {
				const res = await this.$channel.bindQueue(name, exchange, routingKey || name);
				return [null, res];
			} catch (error) {
				this.logger.error(error);
				return [error, null];
			}
		},

		async startConsumers() {
			const { channels: channelsConfig } = this.settings.amqp;

			if (!this.$queues.length) return;

			const queues = this.$queues.filter(q => q.active);
			this.logger.info(`Starting consumers for ${queues.length} queues...`);

			for (const queue of queues) {
				queue.connect = async () => {
					const channel = await this.createChannel(`queue-consumer-${queue.name}`);
					queue.channel = channel;
					this.$channels[queue.name] = channel;

					await channel.prefetch(queue.prefetch);
					await channel.consume(queue.name, queue.handler.bind(this, channel), channelsConfig.consume);

					channel.on('close', () => {
						this.logger.info(`Reconnecting queue-consumer-${queue.name}`);
						delete queue.channel;
						queue.connect();
					});
				};

				await queue.connect();
			}
		},

		async startReporter() {
			const { queuesReporter } = this.settings.amqp;

			if (this.$reporter) {
				this.$reporter.stop();
				delete this.$reporter;
			}

			this.$reporter = new CronJob(queuesReporter.cron, async () => {
				let report = [];

				for (const [i, queue] of this.$queues.entries()) {
					try {
						const { messageCount } = await this.$channel.checkQueue(queue.name);
						report.push({ queueName: queue.name, messageCount });
						this.$queues[i].messageCount = messageCount;
					} catch (error) { 
						// this.logger.error('Error checking queue:', error);
					}
				}

				if (queuesReporter.print) {
					if (report.length) {
						this.logger.info(`${this.name} queues report:`);
						console.table(report);
					} else {
						this.logger.info('No queues to report...');
					}
				}
			});

			this.$reporter.start();
		},

		async sendMessage({ body, queue, routingKey }) {
			const {
				queues,
				exchange,
				messages: messagesConfig,
			} = this.settings.amqp;

			let queueName = queues.prefix + queue;

			let content = isObject(body)
				? JSON.stringify(this.removeNulls(body))
				: body;

			content = Buffer.from(content);

			return !exchange.name
				? this.$channel.sendToQueue(queueName, content, messagesConfig)
				: this.$channel.publish(
					exchange.name,
					routingKey || queueName,
					content,
					messagesConfig
				);
		},

		removeNulls(obj) {
			Object.keys(obj).forEach(key => {
				if (obj[key] === null) {
					delete obj[key]; // Delete if value is null
				} else if (Array.isArray(obj[key])) {
					obj[key] = obj[key].filter(item => item !== null); // Remove nulls from arrays
					obj[key].forEach(item => {
						if (typeof item === 'object') this.removeNulls(item); // Recurse into array items if they are objects
					});
				} else if (typeof obj[key] === 'object') {
					this.removeNulls(obj[key]); // Recurse into nested objects
				}
			});

			return obj;
		},
	},
};
