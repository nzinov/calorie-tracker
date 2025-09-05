import { db } from "./db"

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function ensureDailyLog(userId: string, date: Date = startOfToday()) {
  return db.dailyLog.upsert({
    where: { userId_date: { userId, date } },
    update: {},
    create: { userId, date },
  })
}

export async function addFoodEntry(userId: string, args: {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
  date?: string | Date
}) {
  const date = args.date ? new Date(args.date) : startOfToday()
  date.setHours(0, 0, 0, 0)
  const dailyLog = await ensureDailyLog(userId, date)
  return db.foodEntry.create({
    data: {
      name: args.name,
      quantity: args.quantity,
      calories: Number(args.calories),
      protein: Number(args.protein),
      carbs: Number(args.carbs),
      fat: Number(args.fat),
      fiber: Number(args.fiber),
      salt: Number(args.salt),
      dailyLogId: dailyLog.id,
    },
  })
}

export async function editFoodEntry(userId: string, id: string, args: Partial<{
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  salt: number
}>) {
  // Optionally could verify the entry belongs to user's daily log
  return db.foodEntry.update({
    where: { id },
    data: {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.quantity !== undefined ? { quantity: args.quantity } : {}),
      ...(args.calories !== undefined ? { calories: Number(args.calories) } : {}),
      ...(args.protein !== undefined ? { protein: Number(args.protein) } : {}),
      ...(args.carbs !== undefined ? { carbs: Number(args.carbs) } : {}),
      ...(args.fat !== undefined ? { fat: Number(args.fat) } : {}),
      ...(args.fiber !== undefined ? { fiber: Number(args.fiber) } : {}),
      ...(args.salt !== undefined ? { salt: Number(args.salt) } : {}),
    },
  })
}

export async function deleteFoodEntry(userId: string, id: string) {
  // Optionally could verify the entry belongs to user's daily log
  await db.foodEntry.delete({ where: { id } })
  return { ok: true }
}
