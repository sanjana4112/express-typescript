import type { User } from "@/api/user/userModel";

export const users: User[] = [
	{
		id: 1,
		name: "Alice",
		email: "alice@example.com",
		age: 42,
		createdAt: new Date(),
		updatedAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days later
	},
	{
		id: 2,
		name: "Robert",
		email: "Robert@example.com",
		age: 21,
		createdAt: new Date(),
		updatedAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days later
	},
];

export class UserRepository {
	// Return copies so callers can't change the stored users by accident
	async findAllAsync(): Promise<User[]> {
		return structuredClone(users);
	}

	async findByIdAsync(id: number): Promise<User | null> {
		const user = users.find((user) => user.id === id);
		return user ? structuredClone(user) : null;
	}
}
