import AmqpMixin from '../../mixins/amqp.mixin.js';

const {
	RABBITMQ_ASSERT_QUEUE = 'true',
	RABBITMQ_ASSERT_EXCHANGE = 'true',
} = process.env;

export default {
	name: 'amqp',
	mixins: [AmqpMixin],

	settings: {
		amqp: {
			exchange: {
				assert: [true, 'true'].includes(RABBITMQ_ASSERT_EXCHANGE),
				type: 'topic',
				name: 'exchange-unidos',
			},

			queues: {
				assert: [true, 'true'].includes(RABBITMQ_ASSERT_QUEUE),
				prefix: 'queue-1.',

				config: {
					maxLength: 1000 * 1000 * 2,
					messageTtl: 1000 * 60 * 60 * 24, // 1 day
				},
			}
		}
	},
};
