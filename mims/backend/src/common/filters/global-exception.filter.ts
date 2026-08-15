import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  // Only in development
  details?: any;
}

/**
 * SECURITY: Global Exception Filter
 * 
 * Prevents sensitive information leakage in error responses:
 * - Hides internal error details from clients
 * - Returns consistent error format
 * - Logs full errors internally for debugging
 * - Maps HTTP exceptions to appropriate status codes
 * - Sanitizes error messages for production
 * 
 * ERROR SANITIZATION:
 * - 500 errors: Return generic "Internal Server Error" without details
 * - 401 errors: Return generic "Unauthorized" without specifics
 * - 403 errors: Return generic "Forbidden" without resource path
 * - 404 errors: Return generic "Not Found"
 * - Validation errors: Return field-specific messages (safe)
 * - Custom errors: Return message as-is if explicitly marked safe
 * 
 * LOG STRATEGY:
 * - Full error logged to console for debugging
 * - Stack traces available in development
 * - Minimal error returned to client
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let error = 'InternalServerError';
    let validationErrors: any = undefined;
    // Set by OperationalException: the message was written for the user and
    // carries no internals, so sanitisation must leave it alone. Without this
    // an operational failure reaches the client as "please try again later",
    // which is unactionable precisely when action is what is needed.
    let isSafeMessage = false;

    // Logged via Nest's Logger, never console. The production build is passed
    // through an obfuscator configured with disableConsoleOutput, which strips
    // every console.* call in our own code — so a console.error here vanishes
    // in the only environment where it matters, and an unhandled error becomes
    // a 500 with no trace of what caused it.
    this.logger.debug(`${request.method} ${request.url}`);

    // Handle Prisma validation errors
    if (exception instanceof BadRequestException) {
      const response = exception.getResponse() as any;
      statusCode = HttpStatus.BAD_REQUEST;
      const responseMessage = response?.message;
      if (Array.isArray(responseMessage)) {
        message = responseMessage.length === 1 ? responseMessage[0] : 'Validation Error';
      } else if (typeof responseMessage === 'string') {
        message = responseMessage;
      } else {
        message = 'Validation Error';
      }
      error = 'BadRequest';
      validationErrors = responseMessage; // Validation error details
    }
    // Handle authentication errors
    else if (exception instanceof UnauthorizedException) {
      statusCode = HttpStatus.UNAUTHORIZED;
      message = 'Invalid credentials or token';
      error = 'Unauthorized';
    }
    // Handle authorization errors
    else if (exception instanceof ForbiddenException) {
      statusCode = HttpStatus.FORBIDDEN;
      message = 'Access denied';
      error = 'Forbidden';
    }
    // Handle not found errors
    else if (exception instanceof NotFoundException) {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      error = 'NotFound';
    }
    // Handle conflict errors (duplicate unique constraint, etc.)
    else if (exception instanceof ConflictException) {
      statusCode = HttpStatus.CONFLICT;
      const exceptionMessage = (exception.getResponse() as any)?.message;
      message = exceptionMessage || 'Conflict - Resource already exists';
      error = 'Conflict';
    }
    // Handle all other HTTP exceptions
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && 'message' in response) {
        message = (response as any).message || 'An error occurred';
        error = (response as any).error || 'Error';
        isSafeMessage = (response as any).safe === true;
      } else if (typeof response === 'string') {
        message = response;
        error = 'Error';
      }
    }
    // Handle unknown exceptions
    else if (exception instanceof Error) {
      // The client is told nothing (right — the message may carry internals),
      // so the log is the ONLY record of what happened. It has to survive the
      // obfuscator, which means Logger rather than console.
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
      message = 'Internal Server Error';
      error = 'InternalServerError';
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Build response
    const errorResponse: ErrorResponse = {
      statusCode,
      message: isSafeMessage ? message : this.sanitizeMessage(message, statusCode),
      error: isSafeMessage ? error : this.sanitizeError(error, statusCode),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Only include validation details in client response
    if (validationErrors) {
      if (Array.isArray(validationErrors) && validationErrors.length === 1) {
        errorResponse.details = validationErrors[0];
      } else {
        errorResponse.details = validationErrors;
      }
    }

    // Send response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Sanitize error message based on HTTP status
   * Hide internal details in production
   */
  private sanitizeMessage(message: string, statusCode: number): string {
    // Internal server errors - never expose details
    if (statusCode >= 500) {
      return 'An unexpected error occurred. Please try again later.';
    }

    // Authentication errors - generic message
    if (statusCode === 401) {
      return 'Authentication failed. Please check your credentials.';
    }

    // Authorization errors - generic message
    if (statusCode === 403) {
      return 'You do not have permission to access this resource.';
    }

    // Not found errors - generic message
    if (statusCode === 404) {
      return 'The requested resource was not found.';
    }

    // Conflict errors - can expose reason (duplicate, constraint, etc.)
    if (statusCode === 409) {
      return message; // Keep original message for duplicate/conflict info
    }

    // Validation errors - expose for user to correct
    if (statusCode === 400) {
      return message; // Keep original message with field details
    }

    // Default to message as-is for safe HTTP statuses
    return message;
  }

  /**
   * Sanitize error code/name
   * Consistent error codes for client error handling
   */
  private sanitizeError(error: string, statusCode: number): string {
    const errorMap: Record<number, string> = {
      400: 'BadRequest',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'NotFound',
      409: 'Conflict',
      429: 'TooManyRequests',
      500: 'InternalServerError',
      502: 'BadGateway',
      503: 'ServiceUnavailable',
    };

    return errorMap[statusCode] || error;
  }
}
