import Sequelize from 'sequelize';

import DbService from '../../mixins/db-service.mixin.js';

export default {
	name: 'users-db',
	mixins: [
		DbService({
			name: 'user',

			options: {
				timestamps: false,
				createdAt: 'created_at',
				updatedAt: 'updated_at',
			},
  
			define: {
				id: {
					type: Sequelize.UUID,
					primaryKey: true,
					defaultValue: crypto.randomUUID(),
				},
				name: Sequelize.STRING,
				username: {
					type: Sequelize.STRING,
					allowNull: false,
					unique: true,
				},
				password: {
					type: Sequelize.STRING,
					allowNull: false,
					unique: false,
				},
				roles: {
					type: Sequelize.ARRAY(Sequelize.STRING),
					allowNull: true,
				},
			},
		})
	],
};