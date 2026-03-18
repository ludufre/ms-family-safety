export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super('HTTP Unauthorized', 401, '')
    this.name = 'UnauthorizedError'
  }
}

export class RequestDeniedError extends HttpError {
  constructor(message = 'HTTP Access Denied') {
    super(message, 403, message)
    this.name = 'RequestDeniedError'
  }
}

export class AggregatorError extends HttpError {
  constructor() {
    super('An upstream aggregator error occurred.', 500, '')
    this.name = 'AggregatorError'
  }
}
