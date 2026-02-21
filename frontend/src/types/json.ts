export type JsonValidation =
  | { valid: true }
  | { valid: false; message: string; line?: number; column?: number }
