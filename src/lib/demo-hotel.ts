import { randomUUID } from "crypto";
import { addRoomsBulk, saveHotelInfo, type HotelInfo } from "./hotel-data";
import { insertSampleTasks, listStoredTasks } from "./store";
import { appendHistory } from "./history";
import type { StoredTask } from "./tasks";

/**
 * Demo hotel (H1): one tap on a fresh start creates demo rooms, a sample
 * hotel info sheet and a few sample tasks. Everything is fake, clearly
 * labelled "(demo)", tasks carry sample:true, and the Owner's
 * "Reset demo data" removes all of it (tasks, rooms, info, history, reports).
 */
export const DEMO_HOTEL_INFO: HotelInfo = {
  hotelName: "Seaside Demo Hotel (demo)",
  address: "1 Demo Street, Demo City (fake address)",
  receptionPhone: "+1 555 0100",
  emergencyNumber: "112",
  wifiName: "DemoHotel-Guest",
  wifiPassword: "welcome123",
  checkIn: "14:00",
  checkOut: "12:00",
  breakfastHours: "07:00–10:30",
  houseRules: "Demo rules: no smoking in rooms. Quiet after 22:00, please.",
  faqs: [
    { id: "demo-parking", question: "Is there parking?", answer: "Demo answer: yes, free parking is behind the hotel (fake demo info)." },
    { id: "demo-breakfast", question: "Where is breakfast?", answer: "Demo answer: breakfast is in the ground-floor restaurant, 07:00–10:30 (fake demo info)." },
  ],
};

const DEMO_TASKS: Array<Pick<StoredTask, "department" | "type" | "title" | "room" | "priority">> = [
  { department: "housekeeping", type: "request", title: "Bring towels (demo)", room: "204", priority: "medium" },
  { department: "maintenance", type: "repair", title: "Fix leak in bathroom (demo)", room: "204", priority: "high" },
  { department: "housekeeping", type: "cleaning", title: "Clean room 105 (demo)", room: "105", priority: "medium" },
  { department: "front_desk", type: "request", title: "Book a taxi (demo)", room: "202", priority: "medium" },
  { department: "room_service", type: "request", title: "Room service order (demo)", room: "201", priority: "low" },
];

export async function loadDemoHotel(actorName = "Owner"): Promise<{ roomsAdded: number; tasksCreated: number; hotelName: string }> {
  const floor1 = await addRoomsBulk(1, 101, 110);
  const floor2 = await addRoomsBulk(2, 201, 210);
  await saveHotelInfo(DEMO_HOTEL_INFO);

  const existing = await listStoredTasks();
  const hasDemo = existing.some((t) => t.title.includes("(demo)"));
  let created: StoredTask[] = [];
  if (!hasDemo) {
    const now = new Date().toISOString();
    created = DEMO_TASKS.map((t) => ({
      ...t, confidence: 0.95, id: randomUUID(), status: "new" as const,
      photos: [], reviewNote: null, aiCheck: null, aiFailCount: 0,
      flaggedTwice: false, sample: true, createdAt: now, updatedAt: now,
    }));
    await insertSampleTasks(created);
    for (const task of created) {
      await appendHistory({ actorName, actorRole: "Owner", room: task.room, taskId: task.id, taskTitle: task.title, taskType: task.type, action: "Task created", details: `Demo task loaded by ${actorName} (demo data).` });
    }
  }
  return { roomsAdded: floor1.added.length + floor2.added.length, tasksCreated: created.length, hotelName: DEMO_HOTEL_INFO.hotelName };
}
