import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
	CreateUserRowSchema,
	CreateUsersSchema,
	GetUserSchema,
	MAX_USERS_PER_REQUEST,
	UserSchema,
} from "@/api/user/userModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { userController } from "./userController";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);

userRegistry.registerPath({
	method: "get",
	path: "/users",
	tags: ["User"],
	responses: createApiResponse(z.array(UserSchema), "Success"),
});

userRouter.get("/", userController.getUsers);

userRegistry.registerPath({
	method: "get",
	path: "/users/{id}",
	tags: ["User"],
	request: { params: GetUserSchema.shape.params },
	responses: createApiResponse(UserSchema, "Success"),
});

userRouter.get("/:id", validateRequest(GetUserSchema), userController.getUser);

const CreateUsersResultSchema = z.object({
	created: z.array(UserSchema),
	failed: z.array(
		z.object({
			row: z.number(),
			email: z.string().nullable(),
			reason: z.enum(["INVALID_INPUT", "DUPLICATE_USER", "DUPLICATE_EMAIL_NEEDS_APPROVAL"]),
			details: z.array(z.string()),
		}),
	),
});

userRegistry.registerPath({
	method: "post",
	path: "/users",
	tags: ["User"],
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({ users: z.array(CreateUserRowSchema).min(1).max(MAX_USERS_PER_REQUEST) }),
				},
			},
		},
	},
	responses: {
		...createApiResponse(CreateUsersResultSchema, "At least one user created", StatusCodes.CREATED),
		...createApiResponse(CreateUsersResultSchema, "No users created", StatusCodes.BAD_REQUEST),
	},
});

userRouter.post("/", validateRequest(CreateUsersSchema), userController.createUsers);
