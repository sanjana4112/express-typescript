import { StatusCodes } from "http-status-codes";

import { CreateUserRowSchema, type User } from "@/api/user/userModel";
import { UserRepository } from "@/api/user/userRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";

export type FailedUserRow = {
	row: number;
	email: string | null;
	reason: "INVALID_INPUT" | "DUPLICATE_USER" | "DUPLICATE_EMAIL_NEEDS_APPROVAL";
	details: string[];
};

// Keys used to compare users, ignoring case and extra spaces
const emailKey = (email: string) => email.trim().toLowerCase();
const userKey = (name: string, email: string) => `${name.trim().replace(/\s+/g, " ").toLowerCase()}|${emailKey(email)}`;

export type CreateUsersResult = {
	created: User[];
	failed: FailedUserRow[];
};

const getRawEmail = (row: unknown): string | null => {
	const email = (row as { email?: unknown } | null)?.email;
	return typeof email === "string" ? email : null;
};

export class UserService {
	private userRepository: UserRepository;

	constructor(repository: UserRepository = new UserRepository()) {
		this.userRepository = repository;
	}

	// Retrieves all users from the database
	async findAll(): Promise<ServiceResponse<User[] | null>> {
		try {
			const users = await this.userRepository.findAllAsync();
			if (!users || users.length === 0) {
				return ServiceResponse.failure("No Users found", null, StatusCodes.NOT_FOUND);
			}
			return ServiceResponse.success<User[]>("Users found", users);
		} catch (ex) {
			const errorMessage = `Error finding all users: $${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure(
				"An error occurred while retrieving users.",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	// Retrieves a single user by their ID
	async findById(id: number): Promise<ServiceResponse<User | null>> {
		try {
			const user = await this.userRepository.findByIdAsync(id);
			if (!user) {
				return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
			}
			return ServiceResponse.success<User>("User found", user);
		} catch (ex) {
			const errorMessage = `Error finding user with id ${id}:, ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}

	// Creates a user for each valid row and reports the rows that could not be created.
	// Row numbers start at 1. The same name + email is never created twice.
	// The same email with a different name needs allowDuplicateEmail: true on that row.
	async createMany(rows: unknown[]): Promise<ServiceResponse<CreateUsersResult | null>> {
		try {
			const existingUsers = await this.userRepository.findAllAsync();
			const usedEmails = new Set(existingUsers.map((user) => emailKey(user.email)));
			const usedUsers = new Set(existingUsers.map((user) => userKey(user.name, user.email)));
			const result: CreateUsersResult = { created: [], failed: [] };

			for (const [index, rawRow] of rows.entries()) {
				const row = index + 1;
				const parsed = CreateUserRowSchema.safeParse(rawRow);
				if (!parsed.success) {
					result.failed.push({
						row,
						email: getRawEmail(rawRow),
						reason: "INVALID_INPUT",
						details: parsed.error.errors.map((e) => `${e.path.join(".") || "row"}: ${e.message}`),
					});
					continue;
				}

				const { name, email, age, allowDuplicateEmail } = parsed.data;
				if (usedUsers.has(userKey(name, email))) {
					result.failed.push({
						row,
						email,
						reason: "DUPLICATE_USER",
						details: ["A user with this name and email already exists."],
					});
					continue;
				}

				if (usedEmails.has(emailKey(email)) && !allowDuplicateEmail) {
					result.failed.push({
						row,
						email,
						reason: "DUPLICATE_EMAIL_NEEDS_APPROVAL",
						details: ["This email is already used by another user. Approve to create anyway."],
					});
					continue;
				}

				result.created.push(await this.userRepository.createAsync({ name, email, age }));
				usedEmails.add(emailKey(email));
				usedUsers.add(userKey(name, email));
			}

			const message = `${result.created.length} of ${rows.length} users created`;
			if (result.created.length === 0) {
				return ServiceResponse.failure(message, result, StatusCodes.BAD_REQUEST);
			}
			return ServiceResponse.success(message, result, StatusCodes.CREATED);
		} catch (ex) {
			const errorMessage = `Error creating users: ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure(
				"An error occurred while creating users.",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}
}

export const userService = new UserService();
