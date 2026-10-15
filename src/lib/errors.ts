/** An error whose message is safe and useful to show to the person using the app. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "invalid",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  console.error(err);
  return "Something went wrong. Nothing was saved. Try again, and tell your administrator if it keeps happening.";
}
