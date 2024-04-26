import { ServiceBroker } from 'moleculer';
// Load service schema
import ServiceSchema from '../../../../src/services/web/auth.service.js';
import { expect, jest } from '@jest/globals';
import { when } from 'jest-when';
import { Errors } from 'moleculer';
import sinon from 'sinon';
const { MoleculerError } = Errors;

describe('Test Auth', () => {
	// Create a service broker
	let broker = new ServiceBroker({ logger: false });
	// Create the actual service
	let service = broker.createService(ServiceSchema);

	const stubFind = sinon.stub();
	const stubCreate = sinon.stub();
	const mockUsersDbService = {
		name: 'users-db',
		actions: {
			find: stubFind,
			create: stubCreate,
		},
	};
	service.dependencies = {
		'users-db': mockUsersDbService,
	};

	service.broker.createService(mockUsersDbService);

	beforeAll(() => broker.start());
	beforeEach(() => stubFind.reset());
	afterAll(() => broker.stop());

	/** Tests go here **/
	describe("Test 'auth.login' action", () => {
		it("should return with 'User does not exist' error", async () => {
			expect.assertions(1);
			const req = {
				username: 'user@gmail.com',
				password: '1234',
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([]);
			try {
				await broker.call('auth.login', req);
			} catch (err) {
				expect(err).toEqual(new MoleculerError('User does not exist'));
			}
		});
		it("should return with 'Invalid password' error", async () => {
			expect.assertions(1);
			const req = {
				username: 'user@email.com',
				password: '1234',
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([{ username: req.username, password: '12345' }]);
			try {
				await broker.call('auth.login', req);
			} catch (err) {
				expect(err).toEqual(new MoleculerError('Invalid password'));
			}
		});
		it('should return with a token', async () => {
			expect.assertions(1);
			const req = {
				username: 'user@email.com',
				password: '1234',
			};
			const user = {
				username: req.username,
				password:
					'$2b$10$VTqfunKgiiQY4Lc8KJXbn.CqobBLcJvjs2tOyRHboe.6L/V3VYFl.',
				id: 1,
				role: 'admin',
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([user]);
			const token = await broker.call('auth.login', req);
			expect(token).toBeDefined();
		});
	});
	describe("Test 'auth.register' action", () => {
		it("should return with 'User exists' error", async () => {
			expect.assertions(1);
			const req = {
				username: 'user@email.com',
				password: 'password',
				name: 'John Doe',
				role: 'user',
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([{ username: req.username }]);
			try {
				await broker.call('auth.register', req);
			} catch (err) {
				expect(err).toEqual(new MoleculerError('User exists'));
			}
		});
		it("should return with 'User not Created' error", async () => {
			expect.assertions(1);
			const req = {
				username: 'JohnDoe@email.com',
				password: 'password',
				name: 'John Doe',
				role: 'user',
			};
			const createdUser = {
				id: 1,
				username: req.username,
				password: req.password,
				name: req.name,
				roles: ['user'],
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([]);
			stubCreate
				.withArgs(
					sinon.match.hasNested(
						'params.username',
						sinon.match(req.username)
					)
				)
				.resolves(false);
			try {
				await broker.call('auth.register', req);
			} catch (err) {
				expect(err).toEqual(new MoleculerError('User not created'));
			}
		});
		it('should return with a user', async () => {
			expect.assertions(1);
			const req = {
				username: 'JohnDoe@email.com',
				password: 'password',
				name: 'John Doe',
				role: 'user',
			};
			const createdUser = {
				id: 1,
				username: req.username,
				password: req.password,
				name: req.name,
				roles: ['user'],
			};
			stubFind
				.withArgs(
					sinon.match.hasNested(
						'params.query.username',
						sinon.match(req.username)
					)
				)
				.resolves([]);

			stubCreate
				.withArgs(
					sinon.match.hasNested(
						'params.username',
						sinon.match(req.username)
					)
				)
				.resolves(createdUser);
			const user = await broker.call('auth.register', req);
			expect(user).toBeDefined();
		});
	});
});
