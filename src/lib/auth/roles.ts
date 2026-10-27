export type Role = "requester" | "donor" | "staff" | "admin";

export function homeFor(role: Role): string {
  switch (role) {
    case "donor":
      return "/donor/dashboard";
    case "staff":
      return "/hospital/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/request-blood";
  }
}
