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
    ...(info.generalInfo.trim() ? [`General information: ${info.generalInfo.trim()}`] : []),
    ...(info.recommendations.length
      ? [`Our recommendations (suggest these FIRST for nearby questions):`, ...info.recommendations.map((r) => `- ${r.title}${r.note ? `: ${r.note}` : ""}`)]
      : []),
    ...info.faqs.map((f) => `Q: ${f.question} A: ${f.answer}`),
  ];
  return lines.filter((l) => !l.endsWith(": ")).join("\n");
}

// ---- G3: handoff triggers, nearby and changing-detail rules ----

export type HandoffReason = "human" | "cannot_answer" | "complaint";
export interface AssistantResult { reply: string; tasks: Task[]; handoff?: HandoffReason | null }

const HUMAN_WORDS = /talk to a (real )?(person|human)|real person|real human|speak to (a )?(person|human|someone real)|human please|front desk person|живой человек|настоящий человек|человек[ау]? (позови|подключи)|позови(те)? человек|хочу человек|оператор[ау]?/i;
export function needsHuman(text: string): boolean { return HUMAN_WORDS.test(text); }

const COMPLAINT_WORDS = /angry|furious|complaint|complain|unacceptable|terrible|awful|horrible|disgusting|worst hotel|ruined|refund|i want the manager|call the manager|зл(ой|юсь|ит)|ужас|отвратител|кошмар|жалоб|возмущ|недоволен|недовольн|верните деньги/i;
export function isComplaint(text: string): boolean { return COMPLAINT_WORDS.test(text) || /!{3,}/.test(text); }

const NEARBY_WORDS = /nearby|near here|around here|what (can|to) (i|we) do|places to (visit|see|go)|things to do|visit|see|sight|attraction|restaurant|caf[eé]|pharmacy|transport|museum|park|куда (сходить|пойти)|что посмотреть|рядом|достопримечательн|ресторан|кафе|аптек|музе|парк/i;
export function isNearbyQuestion(text: string): boolean { return NEARBY_WORDS.test(text); }

const EXTERNAL_DETAIL_WORDS = /(what time|when) does .{0,40}(open|close)|opening hours|ticket prices?|how much .{0,30}(ticket|entry|admission)|how far|distance|how long does it take to (get|reach)|bus times?|train times?|во сколько .{0,40}(открыва|закрыва)|сколько (стоит|стоят) билет|как далеко|сколько ехать/i;
export function isExternalDetailQuestion(text: string): boolean { return EXTERNAL_DETAIL_WORDS.test(text); }

const SENSITIVE_WORDS = /doctor|medical advice|medicine|diagnos|symptom|i feel (sick|ill|dizzy)|lawyer|legal advice|lawsuit|visa rules?|is it safe|safety advice|врач|лекарств|болит|плохо себя|юрист|адвокат|безопасно ли/i;
export function isSensitiveAdvice(text: string): boolean { return SENSITIVE_WORDS.test(text); }

export function handoffReply(ru: boolean): string {
  return ru ? "Я попросил(а) администратора присоединиться к этому чату." : "I've asked the front desk to join this chat.";
}

export function externalDetailReply(info: HotelInfo, ru: boolean): string {
  return ru
    ? `Точную актуальную информацию об этом я не подскажу, чтобы не ошибиться. На ресепшн (${info.receptionPhone}) дадут текущие детали.`
    : `I don't have current details on that, and I don't want to guess. The front desk (${info.receptionPhone}) can give you the current details.`;
}

export function sensitiveReply(info: HotelInfo, ru: boolean): string {
  return ru
    ? `Пожалуйста, позвоните прямо сейчас на ресепшн: ${info.receptionPhone}, а в экстренном случае — по номеру ${info.emergencyNumber}.`
    : `Please call reception now at ${info.receptionPhone}, or the emergency number ${info.emergencyNumber} if it is urgent.`;
}

/** Deterministic nearby answer for MOCK mode: owner recommendations first. */
export function recommendationsReply(info: HotelInfo, ru: boolean): string {
  if (info.recommendations.length) {
    const list = info.recommendations.map((r) => (r.note ? `${r.title} — ${r.note}` : r.title)).join("; ");
    return ru ? `Вот наши рекомендации: ${list}. Приятной прогулки!` : `Here are our own recommendations: ${list}. Enjoy!`;
  }
  if (info.generalInfo.trim()) {
    return ru
      ? `Немного о нас и районе: ${info.generalInfo.trim()} На ресепшн с радостью подскажут, что посмотреть рядом.`
      : `A little about us and the area: ${info.generalInfo.trim()} The front desk will happily suggest places nearby too.`;
  }
  return ru ? "На ресепшн с радостью подскажут, что посмотреть рядом." : "The front desk will happily suggest nice places nearby.";
}

function sheetOverlap(message: string, info: HotelInfo): number {
  const words = new Set(hotelInfoText(info).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4));
  return message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4 && words.has(w)).length;
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
export function mockAssistant(message: string, info: HotelInfo, room: string): AssistantResult {
  const ru = isRussian(message);
  if (isEmergency(message)) return { reply: emergencyReply(info, ru), tasks: [urgentTask(message, room)] };
  if (needsHuman(message)) return { reply: handoffReply(ru), tasks: [], handoff: "human" };
  if (isComplaint(message)) return { reply: handoffReply(ru), tasks: [], handoff: "complaint" };
  const answer = infoAnswer(message, info);
  if (answer && !hasRequestIntent(message.replace(/wi-?fi|вай.?фай|парол|breakfast|завтрак/gi, ""))) return { reply: answer, tasks: [] };
  if (isNearbyQuestion(message)) return { reply: recommendationsReply(info, ru), tasks: [] };
  if (isExternalDetailQuestion(message)) return { reply: externalDetailReply(info, ru), tasks: [] };
  if (isSensitiveAdvice(message)) return { reply: sensitiveReply(info, ru), tasks: [] };
  if (CHITCHAT.test(message)) return { reply: ru ? "Здравствуйте! Рады помочь — напишите, что вам нужно." : "Hello! Happy to help — just tell me what you need.", tasks: [] };
  if (isQuestion(message) && !hasRequestIntent(message)) return { reply: handoffReply(ru), tasks: [], handoff: "cannot_answer" };
  const tasks = mockTasks(message);
  // Friendly towel wording from the spec example.
  if (!ru && tasks.length === 1 && /towel/i.test(message)) return { reply: "I've passed this to housekeeping, towels are on the way. Thank you!", tasks };
  if (!ru && tasks.length === 1 && /pillow/i.test(message)) return { reply: "I've passed this to housekeeping, a pillow is on the way. Thank you!", tasks };
  return { reply: confirmReply(tasks, ru), tasks };
}

/** Guardrails applied to the LIVE model answer too — rules hold even if the model slips. */
export function applyGuardrails(message: string, info: HotelInfo, room: string, result: AssistantResult): AssistantResult {
  const ru = isRussian(message);
  if (isEmergency(message)) {
    const tasks = result.tasks.some((t) => t.priority === "high") ? result.tasks : [urgentTask(message, room), ...result.tasks];
    return { reply: emergencyReply(info, ru), tasks: tasks.slice(0, 10), handoff: null };
  }
  if (needsHuman(message)) return { reply: handoffReply(ru), tasks: [], handoff: "human" };
  if (isComplaint(message)) return { reply: handoffReply(ru), tasks: [], handoff: "complaint" };
  const answer = infoAnswer(message, info);
  if (answer && !hasRequestIntent(message.replace(/wi-?fi|вай.?фай|парол|breakfast|завтрак/gi, ""))) return { reply: answer, tasks: [], handoff: null };
  if (isNearbyQuestion(message)) {
    // The model's suggestions are welcome here; owner recommendations lead.
    const reply = result.reply.trim() || recommendationsReply(info, ru);
    return { reply: reply.slice(0, 1000), tasks: [], handoff: null };
  }
  if (isExternalDetailQuestion(message)) return { reply: externalDetailReply(info, ru), tasks: [], handoff: null };
  if (isSensitiveAdvice(message)) return { reply: sensitiveReply(info, ru), tasks: [], handoff: null };
  if (result.handoff) return { reply: handoffReply(ru), tasks: [], handoff: result.handoff };
  if (result.tasks.some((t) => t.department === "front_desk") && isQuestion(message) && !hasRequestIntent(message)) {
    return { reply: handoffReply(ru), tasks: [], handoff: "cannot_answer" };
  }
  if (/front desk/i.test(result.reply) && isQuestion(message) && !hasRequestIntent(message) && sheetOverlap(message, info) < 2) {
    return { reply: handoffReply(ru), tasks: [], handoff: "cannot_answer" };
  }
  if (isQuestion(message) && !hasRequestIntent(message) && !CHITCHAT.test(message) && sheetOverlap(message, info) < 2 && result.tasks.length === 0) {
    // A hotel question the sheet cannot support: hand over instead of guessing.
    // (Sheet-supported questions overlap the sheet text, checked above.)
    if (!/recommend|suggest|famous|well-known/i.test(result.reply)) {
      return { reply: handoffReply(ru), tasks: [], handoff: "cannot_answer" };
    }
  }
  return {
    reply: result.reply.trim().slice(0, 1000) || confirmReply(result.tasks, ru),
    tasks: result.tasks,
    handoff: null,
  };
}

export function buildSystemPrompt(info: HotelInfo, room: string): string {
  return `You are the friendly AI assistant of a hotel, talking to the guest in room ${room}. Return ONLY JSON, no markdown: {"reply":"short reply to the guest","handoff":null,"tasks":[{"department":"housekeeping","type":"request","title":"Bring towels","priority":"medium","confidence":0.95}]}
"handoff" is null normally, or one of "human" (the guest asks for a real person), "complaint" (the guest is upset or complaining), "cannot_answer" (you cannot answer from the sheet). When handoff is set, tasks must be [] and the reply must be exactly: I've asked the front desk to join this chat.

Reply rules (always follow):
- Reply in the guest's language, short, warm and honest. Never promise a time ("in 5 minutes" is forbidden).
- Requests: confirm which team got it, e.g. "I've passed this to housekeeping, towels are on the way". Create one task per separate request ("leak in the bathroom and bring towels" = a repair for maintenance + a request for housekeeping).
- department must be one of: ${DEPARTMENTS.join(", ")}. type must be one of: request (bring/deliver/info/taxi/food), cleaning (clean a room), repair (fix something broken). priority: high/medium/low. confidence: 0 to 1. title: short English task title for staff.
- Hotel facts (Wi-Fi, times, rules, services, prices) are answered ONLY from this hotel info sheet. Never invent them. If the answer is not in the sheet, do not guess: set "handoff":"cannot_answer" as above.
- For "what can I do nearby" type questions: first use "Our recommendations" from the sheet, then "General information". You may add well-known public places from general knowledge (for example famous landmarks of the city named in General information), framed as suggestions ("you could visit…").
- Never state changing details that are not in the sheet: opening hours, ticket prices, distances, transport times. For those, say the front desk can give current details, with no handoff.
- No medical, legal or safety advice beyond telling the guest to call the emergency number / reception now.
- Emergencies (fire, gas smell, someone hurt or ill, water flooding): reply telling the guest to call the reception or emergency number from the sheet NOW, and create an urgent (priority high) task.
- Never invent prices, never share other guests' information. Chit-chat gets a short friendly reply and no task ("tasks": []).
- Use the recent chat for follow-ups ("and one more pillow" means one more housekeeping request).

Hotel info sheet (the ONLY source for hotel facts):
${hotelInfoText(info)}`;
}
