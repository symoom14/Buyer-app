const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export function sanitizeUsernameInput(rawValue) {
  return String(rawValue || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function validateUsernameInput(rawValue) {
  const username = sanitizeUsernameInput(rawValue);

  if (!username) {
    return { ok: false, error: "Username is required", value: "" };
  }

  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      error: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`,
      value: "",
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Username can use a-z, 0-9, dot, underscore, and hyphen",
      value: "",
    };
  }

  return { ok: true, error: "", value: username };
}

export function validatePasswordInput(rawValue) {
  const password = String(rawValue || "");

  if (!password) {
    return { ok: false, error: "Password is required", value: "" };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
      value: "",
    };
  }

  if (CONTROL_CHAR_PATTERN.test(password)) {
    return {
      ok: false,
      error: "Password contains unsupported characters",
      value: "",
    };
  }

  return { ok: true, error: "", value: password };
}

export function buildBuyerEmailFromUsername(rawValue) {
  const username = sanitizeUsernameInput(rawValue);
  return `${username}@buyer.app`;
}
