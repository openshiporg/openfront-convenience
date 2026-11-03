/** keystoneClient maps the User.email unique-constraint failure to "A record with this email already exists."; nothing else is treated as a duplicate. */
export const isDuplicateEmail = (message: unknown) => typeof message === "string" && /record with this email already exists/i.test(message);
