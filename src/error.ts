export class DrygenError extends Error {
	constructor(message: string, readonly cause: Error) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}
