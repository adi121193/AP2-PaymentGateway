import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import {
  ApiError,
  ErrorCode,
  error as createErrorResponse,
} from "@ap2/domain";
import { logError } from "../logger.js";

/**
 * Global error handler middleware
 * Catches all errors thrown by routes and middleware
 * Returns standardized error responses
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error with context
  logError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    res.status(400).json(
      createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        validationErrors
      )
    );
    return;
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode ?? 500).json(err.toResponse());
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json(
      createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Database validation error",
        process.env.NODE_ENV === "development" ? { error: err.message } : undefined
      )
    );
    return;
  }

  // Handle general errors
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(500).json(
    createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Internal server error",
      isDevelopment
        ? {
            message: err.message,
            stack: err.stack,
          }
        : undefined
    )
  );
}

/**
 * Handle Prisma-specific errors with meaningful messages
 */
function handlePrismaError(
  err: Prisma.PrismaClientKnownRequestError,
  res: Response
): void {
  const isDevelopment = process.env.NODE_ENV === "development";

  switch (err.code) {
    case "P2002": // Unique constraint violation
      res.status(409).json(
        createErrorResponse(
          ErrorCode.DUPLICATE_REQUEST,
          "A record with this value already exists",
          isDevelopment ? { field: err.meta?.target } : undefined
        )
      );
      break;

    case "P2025": // Record not found
      res.status(404).json(
        createErrorResponse(
          ErrorCode.NOT_FOUND,
          "Resource not found",
          isDevelopment ? { details: err.meta } : undefined
        )
      );
      break;

    case "P2003": // Foreign key constraint failed
      res.status(400).json(
        createErrorResponse(
          ErrorCode.INVALID_REQUEST,
          "Referenced resource does not exist",
          isDevelopment ? { field: err.meta?.field_name } : undefined
        )
      );
      break;

    case "P2014": // Required relation violation
      res.status(400).json(
        createErrorResponse(
          ErrorCode.INVALID_REQUEST,
          "Required relation is missing",
          isDevelopment ? { relation: err.meta?.relation_name } : undefined
        )
      );
      break;

    default:
      // Generic database error
      res.status(500).json(
        createErrorResponse(
          ErrorCode.DATABASE_ERROR,
          "Database operation failed",
          isDevelopment
            ? {
                code: err.code,
                meta: err.meta,
              }
            : undefined
        )
      );
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Passes errors to the error handler middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
