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

// Fields the caller provides; the repository sets id and timestamps
export type NewUser = Pick<User, "name" | "email" | "age">;

let nextId = Math.max(0, ...users.map((user) => user.id)) + 1;

export class UserRepository {
	// Return copies so callers can't change the stored users by accident
	async findAllAsync(): Promise<User[]> {
		return structuredClone(users);
	}

	async findByIdAsync(id: number): Promise<User | null> {
		const user = users.find((user) => user.id === id);
		return user ? structuredClone(user) : null;
	}

	async createAsync(newUser: NewUser): Promise<User> {
		const now = new Date();
		const user: User = { id: nextId++, ...newUser, createdAt: now, updatedAt: now };
		users.push(user);
		return structuredClone(user);
	}
}
