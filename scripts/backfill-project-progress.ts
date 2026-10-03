/**
 * One-time backfill: set each project's stored `progress` to the rounded
 * average of its sites (0 when siteless).
 * Run: npx tsx scripts/backfill-project-progress.ts
 * (needs MONGODB_URI in .env.local or .env)
 *
 * Reads never use the stored value (progress is derived on read), so this
 * is cosmetic consistency only.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Site } from "@/models/Site";
import { derivedProjectProgress } from "@/lib/progress";

async function main() {
  await connectDB();
  const projects = await Project.find({}).select("_id name").lean();
  let updated = 0;
  for (const p of projects) {
    const sites = await Site.find({ project: p._id }).select("progress").lean();
    const progress = derivedProjectProgress(sites);
    await Project.updateOne({ _id: p._id }, { $set: { progress } });
    updated += 1;
    console.log(`- ${p.name}: ${progress}% (${sites.length} site(s))`);
  }
  console.log(`\nBackfilled ${updated} project(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
