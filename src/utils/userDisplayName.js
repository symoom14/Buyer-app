export function getUserDisplayName(userData, fallback = "Unknown user") {
  if (!userData) return fallback;

  const name =
    typeof userData.name === "string" ? userData.name.trim() : "";
  if (name) return name;

  const username =
    typeof userData.username === "string" ? userData.username.trim() : "";
  if (username) return username;

  return fallback;
}
