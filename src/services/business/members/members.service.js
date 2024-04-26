export default {
	name: 'members',
	mixins: [],

	settings: {},

	actions: {
		register: {

			async handler(ctx) {
				this.logger.info('OI Juninho', ctx);
				await ctx.call('members-db.create', {
					data: {
						nome: 'Juninho',
						email: 'eu@gmail.com',
					}
				});
			},
		},
	},
};
