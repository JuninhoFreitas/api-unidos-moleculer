import Sequelize from 'sequelize';

import DbService from '../../mixins/db-service.mixin.js';

export default {
	name: 'members-db',
	mixins: [
		DbService({
			name: 'member',

			options: {
				timestamps: false,
				createdAt: 'created_at',
				updatedAt: 'updated_at',
			},
  
			define: {
				id: {
					type: Sequelize.UUIDV4,
					primaryKey: true,
					defaultValue: crypto.randomUUID(),
				},

				nome: Sequelize.STRING,
				email: Sequelize.STRING,
				telefone: Sequelize.STRING,
				dataNascimento: Sequelize.DATE,
				dataBatismo: Sequelize.DATE,
				cargo: Sequelize.STRING,
				endereco: Sequelize.STRING,
				bairro: Sequelize.STRING,
				cidade: Sequelize.STRING,
				cep: Sequelize.STRING,
				conjuge: Sequelize.STRING,
				dataEntrada: Sequelize.DATE,
				dataSaida: Sequelize.DATE,
				situacao: Sequelize.STRING,
				observacao: {
					type: Sequelize.STRING,
					allowNull: true,

				},
			},
		})
	],
};