import { randomUUID } from "crypto";
import { addRoomsBulk, saveHotelInfo, type HotelInfo } from "./hotel-data";
import { insertSampleTasks, listStoredTasks } from "./store";
import { appendHistory } from "./history";
import type { StoredTask } from "./tasks";

/** Fresh-start hotel: rooms, hotel info and a few tasks (sample flag stays internal). */
export const DEMO_HOTEL_INFO: HotelInfo = {
  hotelName: "Seaside Hotel",
  address: "12 Seafront Parade, Brighton",
  receptionPhone: "+1 555 0100",
  emergencyNumber: "112",
  wifiName: "Seaside-Guest",
  wifiPassword: "welcome123",
  checkIn: "14:00",
  checkOut: "12:00",
  breakfastHours: "07:00–10:30",
  houseRules: "No smoking in rooms. Quiet after 22:00, please.",
  generalInfo: "A small friendly seaside hotel in a quiet neighbourhood, a short walk from the old town and the pier.",
  recommendations: [
    { id: "demo-cafe", title: "Café Lumière", note: "A cosy café two streets away, good for breakfast." },
  ],
  faqs: [
    { id: "demo-parking", question: "Is there parking?", answer: "Yes, free parking is behind the hotel." },
    { id: "demo-breakfast", question: "Where is breakfast?", answer: "Breakfast is in the ground-floor restaurant, 07:00–10:30." },
  ],
};

const DEMO_TASKS: Array<Pick<StoredTask, "department" | "type" | "title" | "room" | "priority">> = [
  { department: "housekeeping", type: "request", title: "Bring extra towels", room: "204", priority: "medium" },
  { department: "maintenance", type: "repair", title: "Fix leak under the bathroom sink", room: "204", priority: "high" },
  { department: "housekeeping", type: "cleaning", title: "Clean room 105", room: "105", priority: "medium" },
  { department: "front_desk", type: "request", title: "Book a taxi for 18:30", room: "202", priority: "medium" },
  { department: "room_service", type: "request", title: "Room service: club sandwich and tea", room: "201", priority: "low" },
];

export async function loadDemoHotel(actorName = "Owner"): Promise<{ roomsAdded: number; tasksCreated: number; hotelName: string }> {
  const floor1 = await addRoomsBulk(1, 101, 110);
  const floor2 = await addRoomsBulk(2, 201, 210);
  await saveHotelInfo(DEMO_HOTEL_INFO);

  const existing = await listStoredTasks();
  const hasDemo = existing.some((t) => DEMO_TASKS.some((d) => d.title === t.title && d.room === t.room));
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
      await appendHistory({ actorName, actorRole: "Owner", room: task.room, taskId: task.id, taskTitle: task.title, taskType: task.type, action: "Task created", details: `Task loaded by ${actorName}.` });
    }
  }
  return { roomsAdded: floor1.added.length + floor2.added.length, tasksCreated: created.length, hotelName: DEMO_HOTEL_INFO.hotelName };
}
