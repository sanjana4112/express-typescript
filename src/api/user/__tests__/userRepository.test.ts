import { UserRepository, users } from "@/api/user/userRepository";

describe("userRepository", () => {
	let userRepositoryInstance: UserRepository;

	beforeEach(() => {
		userRepositoryInstance = new UserRepository();
	});

	describe("findAllAsync", () => {
		it("returns all stored users", async () => {
			// Act
			const result = await userRepositoryInstance.findAllAsync();

			// Assert
			expect(result).toEqual(users);
			expect(result[0].createdAt).toBeInstanceOf(Date);
		});

		it("returns a copy, so changing the result does not change stored users", async () => {
			// Arrange
			const originalLength = users.length;
			const originalName = users[0].name;
			const result = await userRepositoryInstance.findAllAsync();

			// Act
			result.push({ ...result[0], id: 999 });
			result[0].name = "Changed";

			// Assert
			expect(users.length).toEqual(originalLength);
			expect(users[0].name).toEqual(originalName);
		});
	});

	describe("findByIdAsync", () => {
		it("returns the user with the given id", async () => {
			// Act
			const result = await userRepositoryInstance.findByIdAsync(1);

			// Assert
			expect(result).toEqual(users.find((user) => user.id === 1));
		});

		it("returns a copy, so changing the result does not change the stored user", async () => {
			// Arrange
			const originalEmail = users.find((user) => user.id === 1)?.email;
			const result = await userRepositoryInstance.findByIdAsync(1);

			// Act
			if (result) result.email = "changed@example.com";

			// Assert
			expect(users.find((user) => user.id === 1)?.email).toEqual(originalEmail);
		});

		it("returns null when no user has the given id", async () => {
			// Act
			const result = await userRepositoryInstance.findByIdAsync(999);

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("createAsync", () => {
		it("stores the user with the next id and timestamps, and returns a copy", async () => {
			// Arrange
			const highestId = Math.max(...users.map((user) => user.id));

			// Act
			const first = await userRepositoryInstance.createAsync({ name: "Maria", email: "maria@example.com", age: 34 });
			const second = await userRepositoryInstance.createAsync({ name: "Dev", email: "dev@example.com", age: 28 });
			first.name = "Changed";

			// Assert
			expect(first.id).toEqual(highestId + 1);
			expect(second.id).toEqual(highestId + 2);
			expect(first.createdAt).toBeInstanceOf(Date);
			expect(first.updatedAt).toEqual(first.createdAt);
			expect(users.find((user) => user.id === first.id)?.name).toEqual("Maria");
		});
	});
});
