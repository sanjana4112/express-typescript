import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export type User = z.infer<typeof UserSchema>;
export const UserSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().email(),
	age: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Input Validation for 'GET users/:id' endpoint
export const GetUserSchema = z.object({
	params: z.object({ id: commonValidations.id }),
});

export const MAX_USERS_PER_REQUEST = 500;

// One row from the admin's upload. Unknown fields (like "id" or extra columns) are dropped.
export type CreateUserRow = z.infer<typeof CreateUserRowSchema>;
export const CreateUserRowSchema = z.object({
	name: z.string().trim().min(1).max(200),
	email: z.string().trim().email().max(254),
	age: z.number().int().min(0).max(150),
	allowDuplicateEmail: z.boolean().optional(),
});

// Input Validation for 'POST users' endpoint. Only checks the list itself;
// each row is checked separately in the service so good rows can still be created.
export const CreateUsersSchema = z.object({
	body: z.object({
		users: z
			.array(z.unknown())
			.min(1, "Must include at least 1 user")
			.max(MAX_USERS_PER_REQUEST, `Must include at most ${MAX_USERS_PER_REQUEST} users`),
	}),
});
