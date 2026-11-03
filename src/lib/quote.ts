/**
 * Quote request submission.
 *
 * The destination (business email / database) is not connected yet.
 * When it is, replace the body of this function with a call to a server
 * function or backend endpoint — the form UI does not need to change.
 */
export type QuoteRequest = {
  name: string;
  phone: string;
  email: string;
  service: string;
  quantity: string;
  description: string;
  dueDate?: string | undefined;
  notes?: string | undefined;
  files: File[];
};

export async function submitQuoteRequest(request: QuoteRequest): Promise<{ ok: true }> {
  // Placeholder: simulate a short network round-trip.
  await new Promise((r) => setTimeout(r, 500));
  if (import.meta.env.DEV) {
    console.info("[quote] request captured (no destination connected yet)", {
      ...request,
      files: request.files.map((f) => f.name),
    });
  }
  return { ok: true };
}
