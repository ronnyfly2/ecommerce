import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

type HttpExceptionResponseShape = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

function isHttpExceptionResponseShape(value: unknown): value is HttpExceptionResponseShape {
  return typeof value === 'object' && value !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: HttpExceptionResponseShape = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (isHttpExceptionResponseShape(exceptionResponse)) {
        const responseMessage = exceptionResponse.message;
        message = Array.isArray(responseMessage)
          ? responseMessage[0] ?? exception.message
          : (responseMessage ?? exception.message);
        error = exceptionResponse;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(Object.keys(error).length > 0 && { error }),
    };

    response.status(status).json(errorResponse);
  }
}
