/** What was submitted, so a form can show it again after a failed save. */
export const submittedValues = (form: FormData): Record<string, string> =>
  Object.fromEntries([...form.entries()].map(([name, value]) => [name, String(value)]))
