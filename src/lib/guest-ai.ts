import { DEPARTMENTS, DEPARTMENT_LABELS, mockTasks, type Task } from "./tasks";
import type { HotelInfo } from "./hotel-data";

/**
 * Guest assistant brain (G1 / ANT-43): reply rules in one place.
 * The model prompt, the MOCK replies and the server guardrails all use
 * these helpers, so the rules cannot drift apart:
 * - reply in the guest's language, short, warm, honest; never promise a time
 * - hotel questions answered ONLY from the info sheet; unknown -> front desk task
 * - emergencies -> tell the guest to call reception/emergency now + urgent task
 * - never invent prices, never share other guests' information
 */

export interface ChatMessage { role: "guest" | "assistant"; content: string }

export function isRussian(text: string): boolean { return /[А-Яа-яЁё]/.test(text); }

const EMERGENCY = /gas smell|smell gas|fire|smoke|flood|flooding|water everywhere|someone (hurt|ill|injured)|hurt|injur|unconscious|bleeding|medical emergency|запах газа|пахнет газом|пожар|горит|дым|потоп|затапливает|травм|без сознания|кровь|человеку плохо|мне плохо/i;
export function isEmergency(text: string): boolean { return EMERGENCY.test(text); }

const REQUEST_WORDS = /bring|need|want|please send|towel|pillow|blanket|sheet|soap|shampoo|tooth|trash|tissue|clean|leak|broken|fix|repair|not working|taxi|breakfast in|food|coffee|order|hungry|принес|нужн|надо|полотен|подушк|одеял|мыло|уберите|уборк|протекает|сломал|не работает|заказ/i;
export function hasRequestIntent(text: string): boolean { return REQUEST_WORDS.test(text); }

const QUESTION_WORDS = /\?|^\s*(what|how|when|where|which|can i|can we|do you|does|is there|is it|are there|сколько|что|как|когда|где|какой|какая|можно ли|есть ли)/i;
export function isQuestion(text: string): boolean { return QUESTION_WORDS.test(text.trim()); }

const CHITCHAT = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you|ok|okay|great|привет|здравствуйте|спасибо|добрый|хорошо|отлично)[\s!.]*$/i;

function faqAnswer(message: string, info: HotelInfo): string | null {
  const words = new Set(message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3));
  let best: { score: number; answer: string } | null = null;
  for (const faq of info.faqs) {
    const qWords = faq.question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 3);
    const score = qWords.filter((w) => words.has(w)).length;
    if (score >= 2 && (!best || score > best.score)) best = { score, answer: faq.answer };
    if (faq.question.trim() && message.toLowerCase().includes(faq.question.toLowerCase().replace(/\?$/, ""))) return faq.answer;
  }
  return best?.answer ?? null;
}

/** Answer from the sheet only. Null when the sheet does not say. */
export function infoAnswer(message: string, info: HotelInfo): string | null {
  const m = message.toLowerCase();
  const ru = isRussian(message);
  if (/wi-?fi|вай.?фай|парол/.test(m) && info.wifiPassword) return ru ? `Wi-Fi: сеть «${info.wifiName}», пароль — ${info.wifiPassword}.` : `The Wi-Fi network is "${info.wifiName}" and the password is "${info.wifiPassword}".`;
  if (/breakfast|завтрак/.test(m) && info.breakfastHours) return ru ? `Завтрак подают с ${info.breakfastHours}.` : `Breakfast is served ${info.breakfastHours}.`;
  if (/check.?out|выезд|высел/.test(m) && info.checkOut) return ru ? `Выезд до ${info.checkOut}.` : `Check-out is by ${info.checkOut}.`;
  if (/check.?in|заезд|засел/.test(m) && info.checkIn) return ru ? `Заезд с ${info.checkIn}.` : `Check-in is from ${info.checkIn}.`;
  if (/emergency number|экстренн|номер.*экстр|scor/.test(m) && info.emergencyNumber) return ru ? `Экстренный номер: ${info.emergencyNumber}. Ресепшн: ${info.receptionPhone}.` : `The emergency number is ${info.emergencyNumber}. Reception: ${info.receptionPhone}.`;
  if (/reception|front desk|phone|call|ресепш|телефон|позвон|стойк/.test(m) && info.receptionPhone) return ru ? `Ресепшн: ${info.receptionPhone}.` : `You can reach reception at ${info.receptionPhone}.`;
  if (/address|where are you|адрес|где.*(наход|отель)/.test(m) && info.address) return ru ? `Наш адрес: ${info.address}.` : `We are at ${info.address}.`;
  if (/rule|smoking|quiet|правил|кур(ить|ение)|шум/.test(m) && info.houseRules) return info.houseRules;
  if (/hotel name|назван|как называется/.test(m)) return info.hotelName;
  return faqAnswer(message, info);
}

export function hotelInfoText(info: HotelInfo): string {
  const lines = [
    `Hotel name: ${info.hotelName}`,
    `Address: ${info.address}`,
    `Reception phone: ${info.receptionPhone}`,
    `Emergency number: ${info.emergencyNumber}`,
    `Wi-Fi name: ${info.wifiName}`,
    `Wi-Fi password: ${info.wifiPassword}`,
    `Check-in: ${info.checkIn}`,
    `Check-out: ${info.checkOut}`,
    `Breakfast hours: ${info.breakfastHours}`,
    `House rules: ${info.houseRules}`,
    ...info.faqs.map((f) => `Q: ${f.question} A: ${f.answer}`),
  ];
  return lines.filter((l) => !l.endsWith(": ")).join("\n");
}

export function emergencyReply(info: HotelInfo, ru: boolean): string {
  return ru
    ? `Пожалуйста, позвоните прямо сейчас на ресепшн: ${info.receptionPhone}, а в экстренном случае — по номеру ${info.emergencyNumber}. Я также срочно предупредил персонал.`
    : `Please call reception now at ${info.receptionPhone}, or the emergency number ${info.emergencyNumber} if it is urgent. I've also sent an urgent alert to our team.`;
}

export function urgentTask(message: string, room: string): Task {
  const water = /flood|leak|water|потоп|затоп|вода/i.test(message);
  return {
    department: water ? "maintenance" : "front_desk",
    type: water ? "repair" : "request",
    title: `URGENT (room ${room}): ${message.trim().slice(0, 90)}`,
    priority: "high",
    confidence: 1,
  };
}

export function frontDeskQuestionTask(message: string): Task {
  return { department: "front_desk", type: "request", title: `Guest question: ${message.trim().slice(0, 90)}`, priority: "medium", confidence: 0.95 };
}

export function askFrontDeskReply(ru: boolean): string {
  return ru ? "Я спрошу об этом на ресепшн и вам ответят. Я уже передал ваш вопрос." : "I'll ask the front desk for you — I've passed your question to them.";
}

function confirmReply(tasks: Task[], ru: boolean): string {
  const parts = tasks.map((t) => {
    const team = DEPARTMENT_LABELS[t.department];
    if (ru) return `передал в ${team === "Housekeeping" ? "службу уборки" : team}: ${t.title}`;
    return `I've passed this to ${team.toLowerCase()}: ${t.title}`;
  });
  if (ru) return `Хорошо! Я ${parts.join("; я также ")}. Персонал займётся этим.`;
  // Warm, honest, no promised time. Friendly specifics for common items.
  return `${parts.join(". Also, ")}. They'll take care of it — thank you for telling us!`;
}

/** Sensible MOCK answer (no AI key). Clearly marked by the route's mode. */
export function mockAssistant(message: string, info: HotelInfo, room: string): { reply: string; tasks: Task[] } {
  const ru = isRussian(message);
  if (isEmergency(message)) return { reply: emergencyReply(info, ru), tasks: [urgentTask(message, room)] };
  const answer = infoAnswer(message, info);
  if (answer && !hasRequestIntent(message.replace(/wi-?fi|вай.?фай|парол|breakfast|завтрак/gi, ""))) return { reply: answer, tasks: [] };
  if (CHITCHAT.test(message)) return { reply: ru ? "Здравствуйте! Рады помочь — напишите, что вам нужно." : "Hello! Happy to help — just tell me what you need.", tasks: [] };
  if (isQuestion(message) && !hasRequestIntent(message)) return { reply: askFrontDeskReply(ru), tasks: [frontDeskQuestionTask(message)] };
  const tasks = mockTasks(message);
  // Friendly towel wording from the spec example.
  if (!ru && tasks.length === 1 && /towel/i.test(message)) return { reply: "I've passed this to housekeeping, towels are on the way. Thank you!", tasks };
  if (!ru && tasks.length === 1 && /pillow/i.test(message)) return { reply: "I've passed this to housekeeping, a pillow is on the way. Thank you!", tasks };
  return { reply: confirmReply(tasks, ru), tasks };
}

/** Guardrails applied to the LIVE model answer too — rules hold even if the model slips. */
export function applyGuardrails(message: string, info: HotelInfo, room: string, result: { reply: string; tasks: Task[] }): { reply: string; tasks: Task[] } {
  const ru = isRussian(message);
  if (isEmergency(message)) {
    const tasks = result.tasks.some((t) => t.priority === "high") ? result.tasks : [urgentTask(message, room), ...result.tasks];
    return { reply: emergencyReply(info, ru), tasks: tasks.slice(0, 10) };
  }
  const answer = infoAnswer(message, info);
  if (answer && !hasRequestIntent(message.replace(/wi-?fi|вай.?фай|парол|breakfast|завтрак/gi, ""))) return { reply: answer, tasks: [] };
  if (isQuestion(message) && !hasRequestIntent(message) && !CHITCHAT.test(message)) {
    const hasFrontDesk = result.tasks.some((t) => t.department === "front_desk");
    return { reply: askFrontDeskReply(ru), tasks: hasFrontDesk ? result.tasks : [frontDeskQuestionTask(message)] };
  }
  return {
    reply: result.reply.trim().slice(0, 1000) || confirmReply(result.tasks, ru),
    tasks: result.tasks,
  };
}

export function buildSystemPrompt(info: HotelInfo, room: string): string {
  return `You are the friendly AI assistant of a hotel, talking to the guest in room ${room}. Return ONLY JSON, no markdown: {"reply":"short reply to the guest","tasks":[{"department":"housekeeping","type":"request","title":"Bring towels","priority":"medium","confidence":0.95}]}

Reply rules (always follow):
- Reply in the guest's language, short, warm and honest. Never promise a time ("in 5 minutes" is forbidden).
- Requests: confirm which team got it, e.g. "I've passed this to housekeeping, towels are on the way". Create one task per separate request ("leak in the bathroom and bring towels" = a repair for maintenance + a request for housekeeping).
- department must be one of: ${DEPARTMENTS.join(", ")}. type must be one of: request (bring/deliver/info/taxi/food), cleaning (clean a room), repair (fix something broken). priority: high/medium/low. confidence: 0 to 1. title: short English task title for staff.
- Hotel questions are answered ONLY from this hotel info sheet. Never invent prices or facts. If the answer is not in the sheet, do not guess: reply "I'll ask the front desk for you" and create one front_desk request task whose title contains the guest's question.
- Emergencies (fire, gas smell, someone hurt or ill, water flooding): reply telling the guest to call the reception or emergency number from the sheet NOW, and create an urgent (priority high) task.
- Never invent prices, never share other guests' information. Chit-chat gets a short friendly reply and no task ("tasks": []).
- Use the recent chat for follow-ups ("and one more pillow" means one more housekeeping request).

Hotel info sheet (the ONLY source for hotel facts):
${hotelInfoText(info)}`;
}
