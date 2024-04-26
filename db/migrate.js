import 'dotenv/config'

import { Sequelize } from 'sequelize'
import { Umzug, SequelizeStorage } from 'umzug'

const {
  POSTGRES_CONNECTION_STRING
} = process.env

const sequelize = new Sequelize(POSTGRES_CONNECTION_STRING);

const umzug = new Umzug({
  logger: console,

  migrations: {
    glob: 'db/migrations/**.*js',
  },

  storage: new SequelizeStorage({
    sequelize,
    timestamps: true,
    tableName: '_migrations',
  }),

  context: {
    Sequelize: Sequelize,
    sequelize: sequelize,
    queryInterface: sequelize.getQueryInterface(),
  },
});

umzug.on('migrating', (migration) =>  console.log(`\n  Migrating: ${migration.name}`))
umzug.on('migrated', (migration) =>   console.log(`\n  Migrating: ${migration.name}, migrated!`))
umzug.on('reverting', (migration) =>  console.log(`\n  Reverting: ${migration.name}`))
umzug.on('reverted', (migration) =>   console.log(`\n  Reverting: ${migration.name}, reverted!`))

umzug.runAsCLI()
