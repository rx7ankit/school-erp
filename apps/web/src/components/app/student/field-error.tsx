export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-xs text-danger">{message}</p> : null;
}
