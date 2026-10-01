import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { User } from "@/api/user/userModel";
import { users } from "@/api/user/userRepository";
import type { CreateUsersResult } from "@/api/user/userService";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("User API Endpoints", () => {
	describe("GET /users", () => {
		it("should return a list of users", async () => {
			// Act
			const response = await request(app).get("/users");
			const responseBody: ServiceResponse<User[]> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("Users found");
			expect(responseBody.responseObject.length).toEqual(users.length);
			responseBody.responseObject.forEach((user, index) => compareUsers(users[index] as User, user));
		});
	});

	describe("GET /users/:id", () => {
		it("should return a user for a valid ID", async () => {
			// Arrange
			const testId = 1;
			const expectedUser = users.find((user) => user.id === testId) as User;

			// Act
			const response = await request(app).get(`/users/${testId}`);
			const responseBody: ServiceResponse<User> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("User found");
			if (!expectedUser) throw new Error("Invalid test data: expectedUser is undefined");
			compareUsers(expectedUser, responseBody.responseObject);
		});

		it("should return a not found error for non-existent ID", async () => {
			// Arrange
			const testId = Number.MAX_SAFE_INTEGER;

			// Act
			const response = await request(app).get(`/users/${testId}`);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("User not found");
			expect(responseBody.responseObject).toBeNull();
		});

		it("should return a bad request for invalid ID format", async () => {
			// Act
			const invalidInput = "abc";
			const response = await request(app).get(`/users/${invalidInput}`);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
			expect(responseBody.responseObject).toBeNull();
		});
	});

	describe("POST /users", () => {
		it("creates good rows, reports bad rows, and stores the new users", async () => {
			// Act
			const response = await request(app)
				.post("/users")
				.send({
					users: [
						{ name: "Maria", email: "maria@example.com", age: 34 },
						{ name: "Bad", email: "nope", age: 30 },
						{ name: "Other Alice", email: "ALICE@example.com", age: 50 },
					],
				});
			const responseBody: ServiceResponse<CreateUsersResult> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.CREATED);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toEqual("1 of 3 users created");
			expect(responseBody.responseObject.failed).toMatchObject([
				{ row: 2, reason: "INVALID_INPUT" },
				{ row: 3, reason: "DUPLICATE_EMAIL_NEEDS_APPROVAL" },
			]);

			const createdId = responseBody.responseObject.created[0].id;
			const getResponse = await request(app).get(`/users/${createdId}`);
			expect(getResponse.statusCode).toEqual(StatusCodes.OK);
			expect(getResponse.body.responseObject.name).toEqual("Maria");
		});

		it("blocks the same upload sent twice", async () => {
			// Arrange
			const upload = { users: [{ name: "Dev", email: "dev@example.com", age: 28 }] };
			await request(app).post("/users").send(upload);

			// Act
			const response = await request(app).post("/users").send(upload);
			const responseBody: ServiceResponse<CreateUsersResult> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.responseObject.failed).toMatchObject([{ row: 1, reason: "DUPLICATE_USER" }]);
		});

		it.each([
			["an empty list", { users: [] }, "Must include at least 1 user"],
			["no list", {}, "Required"],
			["a list that is not a list", { users: "maria" }, "Expected array"],
		])("returns a bad request for %s", async (_label, body, expectedMessage) => {
			// Act
			const response = await request(app).post("/users").send(body);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain(expectedMessage);
			expect(responseBody.responseObject).toBeNull();
		});

		it("accepts 500 rows and rejects 501", async () => {
			// Arrange
			const makeRows = (count: number, prefix: string) =>
				Array.from({ length: count }, (_, i) => ({ name: `User ${i}`, email: `${prefix}${i}@example.com`, age: 30 }));

			// Act
			const tooMany = await request(app)
				.post("/users")
				.send({ users: makeRows(501, "over") });
			const atLimit = await request(app)
				.post("/users")
				.send({ users: makeRows(500, "limit") });

			// Assert
			expect(tooMany.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(tooMany.body.message).toContain("Must include at most 500 users");
			expect(atLimit.statusCode).toEqual(StatusCodes.CREATED);
			expect(atLimit.body.responseObject.created).toHaveLength(500);
		});
	});
});

function compareUsers(mockUser: User, responseUser: User) {
	if (!mockUser || !responseUser) {
		throw new Error("Invalid test data: mockUser or responseUser is undefined");
	}

	expect(responseUser.id).toEqual(mockUser.id);
	expect(responseUser.name).toEqual(mockUser.name);
	expect(responseUser.email).toEqual(mockUser.email);
	expect(responseUser.age).toEqual(mockUser.age);
	expect(new Date(responseUser.createdAt)).toEqual(mockUser.createdAt);
	expect(new Date(responseUser.updatedAt)).toEqual(mockUser.updatedAt);
}
