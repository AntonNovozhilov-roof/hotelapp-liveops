import type { Department } from "./tasks";

/**
 * Demo sign-in accounts (D2 / ANT-38).
 *
 * This is a DEMO password on purpose: it is shown on the /login page so
 * anyone can try the app. Real sign-up and real passwords come later with
 * the database (M2) — never reuse this for anything real.
 */
export const DEMO_PASSWORD = "demo1234";

export type RoleKey =
  | "owner"
  | "supervisor"
  | "housekeeping"
  | "maintenance"
  | "front_desk"
  | "room_service";

export interface DemoUser {
  username: string;
  name: string;
  role: RoleKey;
  roleLabel: string;
  /** Staff users belong to exactly one department; owner/supervisor to none. */
  department: Department | null;
  /** Where this person lands after sign-in. */
  home: string;
  /** Their own screen, in the v1.2 style. */
  screenTitle: string;
  screenSub: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    username: "owner",
    name: "Owner",
    role: "owner",
    roleLabel: "Owner",
    department: null,
    home: "/owner",
    screenTitle: "Owner home",
    screenSub: "Your hotel at a glance. The full morning report comes in M10.",
  },
  {
    username: "supervisor",
    name: "Supervisor",
    role: "supervisor",
    roleLabel: "Supervisor",
    department: null,
    home: "/supervisor",
    screenTitle: "Supervisor review",
    screenSub: "Approve or send back cleaning work waiting in review.",
  },
  {
    username: "aigerim",
    name: "Aigerim",
    role: "housekeeping",
    roleLabel: "Housekeeping · Cleaner",
    department: "housekeeping",
    home: "/staff",
    screenTitle: "My rooms",
    screenSub: "Housekeeping tasks the AI sent to you.",
  },
  {
    username: "ruslan",
    name: "Ruslan",
    role: "maintenance",
    roleLabel: "Maintenance",
    department: "maintenance",
    home: "/staff",
    screenTitle: "Repairs",
    screenSub: "Maintenance tasks the AI sent to you.",
  },
  {
    username: "daniyar",
    name: "Daniyar",
    role: "front_desk",
    roleLabel: "Front desk",
    department: "front_desk",
    home: "/staff",
    screenTitle: "Front desk",
    screenSub: "Front desk tasks the AI sent to you.",
  },
  {
    username: "madina",
    name: "Madina",
    role: "room_service",
    roleLabel: "Room service",
    department: "room_service",
    home: "/staff",
    screenTitle: "Room service orders",
    screenSub: "Room service tasks the AI sent to you.",
  },
];

export function findDemoUser(username: string): DemoUser | null {
  const normalized = username.trim().toLowerCase();
  return DEMO_USERS.find((user) => user.username === normalized) ?? null;
}

/** What pages and APIs may show about a signed-in person (never a password). */
export interface PublicUser {
  username: string;
  name: string;
  role: RoleKey;
  roleLabel: string;
  department: Department | null;
  home: string;
  screenTitle: string;
  screenSub: string;
}

export function toPublicUser(user: DemoUser): PublicUser {
  return {
    username: user.username,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    department: user.department,
    home: user.home,
    screenTitle: user.screenTitle,
    screenSub: user.screenSub,
  };
}
