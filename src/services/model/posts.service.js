import Sequelize from 'sequelize';

import DbService from '../../mixins/db-service.mixin.js';

export default {
	name: 'posts',

	mixins: [
		DbService({
			name: 'post',

			options: {
				timestamps: false,
				createdAt: 'created_at',
				updatedAt: 'updated_at',
			},
  
			define: {
				id: {
					type: Sequelize.BIGINT,
					primaryKey: true,
				},

				// api - harvest index
				title: Sequelize.STRING,
				location: Sequelize.JSON,
				internal: Sequelize.BOOLEAN,
				external: Sequelize.BOOLEAN,
				active: Sequelize.BOOLEAN,
				live: Sequelize.BOOLEAN,
				first_published_at: Sequelize.DATE,
				job_id: Sequelize.BIGINT,
				content: Sequelize.TEXT,
				internal_content: Sequelize.TEXT,
				updated_at: Sequelize.DATE,
				created_at: Sequelize.DATE,
				demographic_question_set_id: Sequelize.BIGINT,
				questions: Sequelize.JSON,
        
				// api - harvest show
				// no additional fields
        
				// api - boards list
				absolute_url: Sequelize.STRING,
				internal_job_id: Sequelize.BIGINT,
				requisition_id: Sequelize.STRING,
				metadata: Sequelize.JSON,
				departments: Sequelize.JSON,
				offices: Sequelize.JSON,

				// api - boards show
				location_questions: Sequelize.JSON,
				data_compliance: Sequelize.JSON,
				pay_input_ranges: Sequelize.JSON,

				// webhook - job_post_created
				// no additional fields
  
				// webhook - job_post_updated
				// no additional fields
  
				// webhook - job_post_deleted
				// no additional fields
  
				// computed additional fields:
				location_name: Sequelize.STRING,

				// crawler
				board_id: Sequelize.BIGINT,
				hiring_plan_id: Sequelize.BIGINT,
				public_url: Sequelize.STRING(512),
				enable_demographic_questions: Sequelize.BOOLEAN,
				enable_required_eeoc: Sequelize.BOOLEAN,
				job_post_location: Sequelize.JSON,

				// control
				_harvested_at: Sequelize.DATE,
				_wh_created_at: Sequelize.DATE,
				_wh_updated_at: Sequelize.DATE,
				_wh_deleted_at: Sequelize.DATE,
				_crawled_at: Sequelize.DATE,
				_revisited_at: Sequelize.DATE,
			},
		})
	],
};
