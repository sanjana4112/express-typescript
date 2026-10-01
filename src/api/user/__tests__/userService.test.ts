import { StatusCodes } from "http-status-codes";
import type { Mock } from "vitest";

import type { User } from "@/api/user/userModel";
import { UserRepository } from "@/api/user/userRepository";
import { UserService } from "@/api/user/userService";

vi.mock("@/api/user/userRepository");

describe("userService", () => {
	let userServiceInstance: UserService;
	let userRepositoryInstance: UserRepository;

	const mockUsers: User[] = [
		{
			id: 1,
			name: "Alice",
			email: "alice@example.com",
			age: 42,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: 2,
			name: "Bob",
			email: "bob@example.com",
			age: 21,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		userRepositoryInstance = new UserRepository();
		userServiceInstance = new UserService(userRepositoryInstance);
	});

	describe("findAll", () => {
		it("return all users", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockReturnValue(mockUsers);

			// Act
			const result = await userServiceInstance.findAll();

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.OK);
			expect(result.success).toBeTruthy();
			expect(result.message).equals("Users found");
			expect(result.responseObject).toEqual(mockUsers);
		});

		it("returns a not found error for no users found", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockReturnValue(null);

			// Act
			const result = await userServiceInstance.findAll();

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("No Users found");
			expect(result.responseObject).toBeNull();
		});

		it("handles errors for findAllAsync", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockRejectedValue(new Error("Database error"));

			// Act
			const result = await userServiceInstance.findAll();

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("An error occurred while retrieving users.");
			expect(result.responseObject).toBeNull();
		});
	});

	describe("findById", () => {
		it("returns a user for a valid ID", async () => {
			// Arrange
			const testId = 1;
			const mockUser = mockUsers.find((user) => user.id === testId);
			(userRepositoryInstance.findByIdAsync as Mock).mockReturnValue(mockUser);

			// Act
			const result = await userServiceInstance.findById(testId);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.OK);
			expect(result.success).toBeTruthy();
			expect(result.message).equals("User found");
			expect(result.responseObject).toEqual(mockUser);
		});

		it("handles errors for findByIdAsync", async () => {
			// Arrange
			const testId = 1;
			(userRepositoryInstance.findByIdAsync as Mock).mockRejectedValue(new Error("Database error"));

			// Act
			const result = await userServiceInstance.findById(testId);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("An error occurred while finding user.");
			expect(result.responseObject).toBeNull();
		});

		it("returns a not found error for non-existent ID", async () => {
			// Arrange
			const testId = 1;
			(userRepositoryInstance.findByIdAsync as Mock).mockReturnValue(null);

			// Act
			const result = await userServiceInstance.findById(testId);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("User not found");
			expect(result.responseObject).toBeNull();
		});
	});

	describe("createMany", () => {
		let nextId: number;

		beforeEach(() => {
			nextId = 3;
			(userRepositoryInstance.findAllAsync as Mock).mockResolvedValue(mockUsers);
			(userRepositoryInstance.createAsync as Mock).mockImplementation(async (newUser) => ({
				id: nextId++,
				...newUser,
				createdAt: new Date(),
				updatedAt: new Date(),
			}));
		});

		it("creates every valid row", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "Maria", email: "maria@example.com", age: 34 },
				{ name: "Dev", email: "dev@example.com", age: 28 },
			]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.CREATED);
			expect(result.success).toBeTruthy();
			expect(result.message).equals("2 of 2 users created");
			expect(result.responseObject?.created.map((user) => user.id)).toEqual([3, 4]);
			expect(result.responseObject?.failed).toEqual([]);
		});

		it("creates good rows and reports bad rows by row number", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "Maria", email: "maria@example.com", age: 34 },
				{ name: "Bad Email", email: "nope", age: 30 },
				{ name: "No Age", email: "noage@example.com" },
			]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.CREATED);
			expect(result.message).equals("1 of 3 users created");
			expect(result.responseObject?.failed).toEqual([
				{ row: 2, email: "nope", reason: "INVALID_INPUT", details: ["email: Invalid email"] },
				{ row: 3, email: "noage@example.com", reason: "INVALID_INPUT", details: ["age: Required"] },
			]);
		});

		it("returns 400 and creates nothing when every row is bad", async () => {
			// Act
			const result = await userServiceInstance.createMany([{ name: "", email: "nope", age: "34" }, null, "maria"]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("0 of 3 users created");
			expect(result.responseObject?.failed.map((row) => row.reason)).toEqual([
				"INVALID_INPUT",
				"INVALID_INPUT",
				"INVALID_INPUT",
			]);
			expect(result.responseObject?.failed[0].details).toHaveLength(3);
			expect(userRepositoryInstance.createAsync).not.toHaveBeenCalled();
		});

		it("rejects ages that are not whole numbers from 0 to 150", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "A", email: "a@example.com", age: -1 },
				{ name: "B", email: "b@example.com", age: 3.5 },
				{ name: "C", email: "c@example.com", age: 151 },
			]);

			// Assert
			expect(result.responseObject?.failed.map((row) => row.row)).toEqual([1, 2, 3]);
		});

		it("flags an email already used by an existing user, ignoring case, without revealing that user", async () => {
			// Act
			const result = await userServiceInstance.createMany([{ name: "New Alice", email: "ALICE@example.com", age: 30 }]);

			// Assert
			const failed = result.responseObject?.failed[0];
			expect(failed?.reason).equals("DUPLICATE_EMAIL_NEEDS_APPROVAL");
			expect(JSON.stringify(failed)).not.toContain('Alice"');
			expect(JSON.stringify(failed)).not.toContain('"id"');
			expect(userRepositoryInstance.createAsync).not.toHaveBeenCalled();
		});

		it("creates the first row and flags later rows with the same email in one upload", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "Adjuster One", email: "adjuster@firm.com", age: 40 },
				{ name: "Adjuster Two", email: "Adjuster@Firm.com", age: 45 },
			]);

			// Assert
			expect(result.responseObject?.created.map((user) => user.name)).toEqual(["Adjuster One"]);
			expect(result.responseObject?.failed).toMatchObject([{ row: 2, reason: "DUPLICATE_EMAIL_NEEDS_APPROVAL" }]);
		});

		it("creates a duplicate email row when it is approved", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "Adjuster Two", email: "alice@example.com", age: 45, allowDuplicateEmail: true },
			]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.CREATED);
			expect(result.responseObject?.created).toHaveLength(1);
		});

		it("blocks the same name and email as an existing user, ignoring case and spaces, even when approved", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: " ALICE ", email: "Alice@Example.com", age: 42 },
				{ name: "alice", email: "alice@example.com", age: 42, allowDuplicateEmail: true },
			]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(result.responseObject?.failed).toMatchObject([
				{ row: 1, reason: "DUPLICATE_USER" },
				{ row: 2, reason: "DUPLICATE_USER" },
			]);
			expect(userRepositoryInstance.createAsync).not.toHaveBeenCalled();
		});

		it("creates the first row and blocks a later row with the same name and email in one upload", async () => {
			// Act
			const result = await userServiceInstance.createMany([
				{ name: "Maria Lopez", email: "maria@example.com", age: 34 },
				{ name: "maria  lopez", email: "MARIA@example.com", age: 34 },
			]);

			// Assert
			expect(result.responseObject?.created).toHaveLength(1);
			expect(result.responseObject?.failed).toMatchObject([{ row: 2, reason: "DUPLICATE_USER" }]);
		});

		it("trims spaces and only stores name, email, and age", async () => {
			// Act
			await userServiceInstance.createMany([
				{ name: " Maria ", email: " maria@example.com ", age: 34, id: 99, phone: "555", allowDuplicateEmail: false },
			]);

			// Assert
			expect(userRepositoryInstance.createAsync).toHaveBeenCalledWith({
				name: "Maria",
				email: "maria@example.com",
				age: 34,
			});
		});

		it("handles errors from the repository", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockRejectedValue(new Error("Database error"));

			// Act
			const result = await userServiceInstance.createMany([{ name: "Maria", email: "maria@example.com", age: 34 }]);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(result.message).equals("An error occurred while creating users.");
			expect(result.responseObject).toBeNull();
		});
	});
});
