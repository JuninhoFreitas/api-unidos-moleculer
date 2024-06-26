/*
 * moleculer
 * Copyright (c) 2018 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

'use strict';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import _ from 'lodash';
import { Errors } from 'moleculer';
const { MoleculerError } = Errors;
import { promisify } from 'util';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';
// Fake user DB
const users = [
	{ id: 1, username: 'admin@gmail.com', password: 'admin', role: 'admin' },
	{ id: 2, username: 'test', password: 'test', role: 'user' },
];

/**
 * Authentication & Authorization service
 */
const name = 'auth';
const actions = {
	login: {
		params: {
			username: 'email',
			password: 'string',
		},
		async handler(ctx) {
			let [user] = await ctx.call('users-db.find', {
				query: { username: ctx.params.username },
			});
			if (!user) {
				return Promise.reject(
					new MoleculerError('User does not exist', 400)
				);
			}
			// Check password
			if (!bcrypt.compareSync(ctx.params.password, user.password)) {
				return Promise.reject(
					new MoleculerError('Invalid password', 400)
				);
			}

			return this.generateToken(user).then((token) => {
				return { token };
			});
		},
	},
	register: {
		params: {
			name: 'string',
			username: 'email',
			password: 'string',
			role: { type: 'enum', values: ['user', 'admin'], optional: true },
		},
		async handler(ctx) {
			// use users-db service to create a new user and find if the user exists
			let [user] = await ctx.call('users-db.find', {
				query: { username: ctx.params.username },
			});
			if (user) {
				return Promise.reject(new MoleculerError('User exists', 422));
			}
			user = {
				username: ctx.params.username,
				password: bcrypt.hashSync(ctx.params.password, 10),
				name: ctx.params.name,
				roles: ['user'],
			};

			this.logger.info(user)

			const createdUser = await ctx.call('users-db.create', user);
			if (!createdUser) {
				return Promise.reject(
					new MoleculerError('User not created', 422)
				);
			}

			return this.generateToken(user).then((token) => {
				return { token };
			});
		},
	},
	verifyToken(ctx) {
		return this.verify(ctx.params.token, JWT_SECRET);
	},

	resolveToken: {
		cache: {
			keys: ['token'],
			ttl: 60 * 60, // 1 hour
		},
		headers: true,
		async handler(ctx, route, req, res) {
			const auth = ctx.meta.authToken.split(' ')[1];
				const verified = await this.verify(auth, JWT_SECRET)
				console.log(verified)
				if (verified.id) {
					// Get user from DB
					ctx.call('users-db.get', { id: verified.id }).then((user) => {
						if (user) {
							return user;
						}
						return this.Promise.reject(
							new MoleculerError('User not found', 401)
						);
					});
				}
		},
	},
};
function created() {
	// Create Promisify encode & verify methods
	this.encode = promisify(jwt.sign);
	this.decode = promisify(jwt.decode);
	this.verify = promisify(jwt.verify);
}
const methods = {
	/**
	 * Generate JWT token
	 *
	 * @param {any} user
	 * @returns
	 */
	generateToken(user) {
		this.logger.info(
			'_.pick(user, ["id", "role"])',
			_.pick(user, ['id', 'role'])
		);
		return this.encode(_.pick(user, ['id', 'role']), JWT_SECRET);
	},
};

export default {
	name,
	actions,
	created,
	methods,
};
