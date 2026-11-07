import { seedDemo } from "@/lib/hera/seed";

/** Reset the database to the demo household. Used by `npm run seed`. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.HERA_ALLOW_SEED !== "1") {
    return Response.json({ error: "Seeding is off in production. Set HERA_ALLOW_SEED=1 to allow it." }, { status: 403 });
  }
  const withPolicy = new URL(req.url).searchParams.get("full") === "1";
  try {
    return Response.json({ profile: await seedDemo({ withPolicy }) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
