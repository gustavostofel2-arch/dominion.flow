import "server-only";

// Únicos e-mails que enxergam o painel administrativo (/admin). Para trocar sem
// mexer no código, defina ADMIN_EMAILS na Vercel (separados por vírgula).
const DEFAULT_ADMIN_EMAILS = ["gustavostofel21@gmail.com", "higormachado.designer@gmail.com"];

function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
