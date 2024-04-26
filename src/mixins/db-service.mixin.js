import pg from 'pg'
import { merge } from "lodash-es";
import pluralize from "pluralize";
import DbService from "moleculer-db";
import { Sequelize } from "sequelize";
import SqlAdapter from "moleculer-db-adapter-sequelize";

import pkg from "../../package.json" assert { type: "json" };

pg.defaults.parseInt8 = true

const SequelizeToSchemaMap = {
  [Sequelize.BIGINT]: "number",
  [Sequelize.BOOLEAN]: "boolean",
  [Sequelize.DATE]: "date",
  [Sequelize.DATEONLY]: "date",
  [Sequelize.FLOAT]: "number",
  [Sequelize.INTEGER]: "number",
  [Sequelize.JSON]: "object",
  [Sequelize.JSONB]: "object",
  [Sequelize.STRING]: "string",
  [Sequelize.TEXT]: "string",
}

const ResponseHeaders = {
  "X-Rate-Limit-Limit": {
    description: "The number of allowed requests in the current period.",
    schema: {
      type: "integer",
      min: 1,
      max: 50,
      default: 50,
    }
  },
  "X-Rate-Limit-Remaining": {
    description: "The number of remaining requests in the current period.",
    schema: {
      type: "integer",
      min: 1,
      max: 50,
      default: 50,
    }
  },
  "X-Rate-Limit-Reset": {
    description: "The number of seconds left in the current period.",
    schema: {
      type: "integer",
      min: 1,
      max: 50,
      default: 50,
    }
  }
}

function queuesTableForResource (name) {
  return [].join('\n')
}

const methods = {
  getFields(definition) {
    return Object.keys(definition).reduce((acc, key) => {
      const defType = definition[key].type ?? definition[key];
      acc[key] = SequelizeToSchemaMap[defType] ?? "string";
      return acc;
    }, {});
  },

  getProperties(definition) {
    const fields = this.getFields(definition);
    return Object.keys(fields).reduce((acc, key) => {
      const defType = fields[key];
      acc[key] = {
        example: `The ${key} attribute must be of ${defType} type.`,
        type: defType,
      };
      return acc;
    }, {});
  },

  responseFor200AtList({ name, definition }) {
    const schema = {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: {
            type: "object",
            $ref: '#/components/schemas/' + name,
          },
        },
        total: { type: "number", example: 2 },
        page: { type: "number", example: 1 },
        pageSize: { type: "number", example: 10 },
        totalPages: { type: "number", example: 1 },
      },
    };

    return schema;
  },

  responseForError500(definition) {
    return {
      type: "object",
      properties: {
        name: {
          example: "SequelizeDatabaseError",
          type: "string",
        },
        message: {
          example: 'invalid input syntax for type bigint: "a"',
          type: "string",
        },
        code: {
          example: 500,
          type: "number",
        },
      },
    };
  },

  responseForError404(definition) {
    return {
      type: "object",
      properties: {
        name: {
          example: "EntityNotFoundError",
          type: "string",
        },
        message: {
          example: "Entity not found",
          type: "string",
        },
        code: {
          example: 404,
          type: "number",
        },
        type: {
          example: "NOT_FOUND_ERROR",
          type: "string",
        },
      },
    };
  },

  responseForError422(definition) {
    return {
      type: "object",
      properties: {
        name: {
          example: "ValidationError",
          type: "string",
        },
        message: {
          example: "Parameters validation error!",
          type: "string",
        },
        code: {
          example: 422,
          type: "number",
        },
        type: {
          example: "VALIDATION_ERROR",
          type: "string",
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: methods.getProperties(definition),
          },
        },
      },
    };
  },

  convertSequelizeModelToOpenapiObject(definition) {
    const fields = this.getFields(definition)

    const schema = {
      type: "object",
      properties: {},
    };

    return Object.keys(fields).reduce((acc, key) => {
      const propertyType = fields[key];

      if (propertyType === "string" || propertyType === "number" || propertyType === "boolean") {
        acc.properties[key] = { type: propertyType };
      } else if (propertyType === "date") {
        acc.properties[key] = { type: "string", format: "date-time" };
      } else {
        acc.properties[key] = { type: "string" };
      }

      return acc;
    }, schema);
  },

  convertSequelizeModelToMoleculerValidation(definition, allOptional = false) {
    const fields = this.getFields(definition)

    Object.keys(fields).reduce((acc, key) => {
      const defType = definition[key].type ?? definition[key];
      const required = definition[key].allowNull === false && !allOptional;

      acc[key] = { type: "string", convert: true, optional: !required };
      return acc
    }, {});
  },
}

export default function (model, sequelizeInstance = null) {
  return {
    settings: {
      resource: {
        autoSync: ['true', true].includes(process.env.DBSERVICE_AUTO_SYNC || 'false'),
      },
    },

    async started() {
      if (this.settings.resource.autoSync) await this.actions.sync()
    },

    mixins: [
      merge({}, DbService, {
        methods,
        model: { ...model },
        adapter: new SqlAdapter(sequelizeInstance || process.env.POSTGRES_CONNECTION_STRING),

        settings: {
          idField: 'id',
          pageSize: 100,
          maxPageSize: 1000,
        },

        actions: {
          async sync() {
            return this.adapter.model.sync({ alter: true })
          },

          async upsert(ctx) {
            const [elem, wasCreated] = await this.adapter.model.upsert(ctx.params);
            elem.$created = wasCreated;
            return elem
          },

          findOrCreate: {
            params: {
              where: "object",
              defaults: "object",
            },

            async handler(ctx) {
              const { where, defaults } = ctx.params

              const [elem, wasCreated] = await this.adapter.model.findOrCreate({ where, defaults, raw: true });
              elem.$created = wasCreated;

              return elem
            },
          },

          list: {
            openapi: {
              summary: `List ${pluralize(model.name)}`,
              description: [
                `Return a paginated list of **${pluralize(model.name)}**.`,
                '',
                `To filter the ${pluralize(model.name)} list you may use the query parameter \`query\`, a key-value object that will be processed by the ORM.`,
                'For a complete documentation of the query parameter, please refer to [the framework documentation here](https://moleculer.services/docs/0.14/moleculer-db#list).',
              ].join('<br>\n'),

              components: {
                schemas: {
                  [model.name]: methods.convertSequelizeModelToOpenapiObject({ ...model.define })
                }
              },

              responses: {

                200: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: success -->',
                    '> #### Success!',
                    `> Here is the page of the ${pluralize(model.name)} list.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          rows: {
                            type: "array",
                            items: {
                              type: "object",
                              $ref: '#/components/schemas/' + model.name,
                            },
                          },
                          total: {
                            type: "number",
                            min: 0,
                            example: 20,
                          },
                          page: {
                            type: "number",
                            min: 1,
                            example: 1,
                          },
                          pageSize: {
                            type: "number",
                            min: 10,
                            max: 1000,
                            default: 100,
                            example: 10,
                          },
                          totalPages: {
                            type: "number",
                            min: 10,
                            example: 1,
                          },
                        },
                      },
                    },
                  },
                },

                429: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Too many requests!',
                    `> Wait the \`X-Rate-Limit-Remaining\` value.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            default: "TooManyRequests",
                          },
                          message: {
                            type: "string",
                            example: "Too many requests!",
                          },
                          code: {
                            type: "number",
                            example: 422,
                          },
                        },
                      },
                    },
                  },
                },

                500: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Server error!',
                    `> System in downtime, come back in a few moments.`,
                  ].join('\n'),
                },

              },
            },
          },

          create: {
            params: methods.convertSequelizeModelToMoleculerValidation({ ...model.define }),

            openapi: {
              summary: `Create a ${pluralize.singular(model.name)}`,

              description: [
                `Create a **${model.name}**.`,
              ].join('<br>\n'),

              requestBody: {
                description: "Information that refence a metric and its value.",

                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/" + model.name,
                    }
                  }
                }
              },

              responses: {

                200: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: success -->',
                    '> #### Success!',
                    `> Here is the created ${pluralize.singular(model.name)}.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        $ref: '#/components/schemas/' + model.name,
                      },
                    },
                  },
                },

                422: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Unprocessable entity!',
                    `> We encountered a validation error.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            default: "ValidationError",
                          },
                          message: {
                            type: "string",
                            default: "Parameters validation error!",
                          },
                          code: {
                            type: "number",
                            default: 422,
                          },
                          type: {
                            type: "string",
                            default: "VALIDATION_ERROR",
                          },
                          data: {
                            type: "array",
                            items: {
                              type: "object",
                            },
                          },
                        },
                      },
                    },
                  },
                },

                429: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Too many requests!',
                    `> Wait the \`X-Rate-Limit-Remaining\` value.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            default: "TooManyRequests",
                          },
                          message: {
                            type: "string",
                            example: "Too many requests!",
                          },
                          code: {
                            type: "number",
                            example: 422,
                          },
                        },
                      },
                    },
                  },
                },

                500: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Server error!',
                    `> System in downtime, come back in a few moments.`,
                  ].join('\n'),
                },

              },
            },
          },

          get: {
            openapi: {
              summary: `Show ${model.name}`,

              description: [
                `Return a **${model.name}**.`,
                '',
                'You may consume the rabbitmq queues:',
                queuesTableForResource(model.name),
              ].join('<br>\n'),

              parameters: [
                {
                  name: 'id',
                  required: true,
                  in: 'path',
                  description: `The ${model.name} id.`,
                  schema: {
                    type: 'number',
                    default: 1,
                    example: 1,
                  },
                },
              ],

              responses: {

                200: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: success -->',
                    '> #### Success!',
                    `> Here is the ${pluralize.singular(model.name)}.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        $ref: '#/components/schemas/' + model.name,
                      }
                    },
                  },
                },

                404: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Not Found!',
                    `> We did not find the element you asked for.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            default: "NotFound",
                          },
                          message: {
                            type: "string",
                            example: "Element not found!",
                          },
                          code: {
                            type: "number",
                            example: 404,
                          },
                        },
                      },
                    },
                  },
                },

                429: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Too many requests!',
                    `> Wait the \`X-Rate-Limit-Remaining\` value.`,
                  ].join('\n'),

                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            default: "TooManyRequests",
                          },
                          message: {
                            type: "string",
                            example: "Too many requests!",
                          },
                          code: {
                            type: "number",
                            example: 422,
                          },
                        },
                      },
                    },
                  },
                },

                500: {
                  headers: ResponseHeaders,

                  description: [
                    '<!-- theme: danger -->',
                    '> #### Server error!',
                    `> System in downtime, come back in a few moments.`,
                  ].join('\n'),
                },

              },
            },
          },

          update: {
            params: methods.convertSequelizeModelToMoleculerValidation(model.define, true),
            openapi: {
              responses: {
                "200": {
                  description: "Update a new element sucessfully",
                  content: {
                    "application/json": {
                      schema: methods.convertSequelizeModelToOpenapiObject({ ...model.define }),
                    },
                  },
                },
                "404": {
                  description: "Not found",
                  content: {
                    "application/json": {
                      schema: methods.responseForError404({ ...model.define }),
                    },
                  },
                },
                "422": {
                  description: "Unprocessable entity - validator error",
                  content: {
                    "application/json": {
                      schema: methods.responseForError422({ ...model.define }),
                    },
                  },
                },
                "500": {
                  description: "Database error",
                  content: {
                    "application/json": {
                      schema: methods.responseForError500({ ...model.define }),
                    },
                  },
                },
              },
            },
          },

          remove: {
            openapi: {
              responses: {
                "200": {
                  description: "Deleted element sucessfully",
                  content: {
                    "application/json": {
                      schema: methods.convertSequelizeModelToOpenapiObject({}),
                    },
                  },
                },
                "404": {
                  description: "Not found",
                  content: {
                    "application/json": {
                      schema: methods.responseForError404({ ...model.define }),
                    },
                  },
                },
              },
            },
          },
        },
      })
    ],
  }
}
