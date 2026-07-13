import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SKILLS = [
  "Parallel Parking",
  "Roundabouts",
  "Dual Carriageway",
  "Bay Parking",
  "Emergency Stop",
  "Reverse Around Corner",
  "Night Driving",
  "Motorway Driving",
];

async function createUser(email: string, password: string, fullName: string, role: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    console.error(`Error creating user ${email}:`, error.message);
    return null;
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    role,
    full_name: fullName,
    phone: "07700 " + Math.floor(100000 + Math.random() * 899999),
    postcode: "WV1 " + Math.floor(1 + Math.random() * 9) + "AA",
  });

  return data.user.id;
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(8 + Math.floor(Math.random() * 10), 0, 0, 0);
  return d;
}

function futureSlots(instructorId: string, count: number) {
  const slots = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + 1 + Math.floor(Math.random() * 13));
    const hour = 8 + Math.floor(Math.random() * 10);
    d.setHours(hour, 0, 0, 0);
    const end = new Date(d);
    end.setHours(hour + 1);

    slots.push({
      instructor_id: instructorId,
      start_time: d.toISOString(),
      end_time: end.toISOString(),
      is_booked: false,
    });
  }
  return slots;
}

const reviews = [
  "Really patient and clear instructions. Helped me master roundabouts!",
  "Best instructor I've had. Very calm and encouraging.",
  "Excellent lesson, covered parallel parking and bay parking.",
  "Great at explaining dual carriageway merging. Felt much more confident.",
  "Very professional. Would highly recommend to anyone nervous about driving.",
  "Helped me pass first time! Can't thank them enough.",
  "Always on time and very well prepared for each lesson.",
  "Made night driving feel much less scary. Great instructor!",
  "Really focused on my weak areas. Emergency stop practice was brilliant.",
  "Fantastic teacher. Patient with my mistakes and great feedback.",
];

async function seed() {
  console.log("🌱 Starting seed...\n");

  // -- Platform admin --
  const adminId = await createUser("admin@drivenow.co.uk", "Admin123!", "Platform Admin", "platform_admin");
  console.log("✅ Platform admin created");

  // -- School owner users --
  const eliteOwnerId = await createUser("elite@drivenow.co.uk", "School123!", "James Wilson", "school_admin");
  const driverightOwnerId = await createUser("driveright@drivenow.co.uk", "School123!", "Rachel Green", "school_admin");

  // -- Schools --
  const { data: eliteSchool } = await supabase
    .from("schools")
    .insert({
      owner_id: eliteOwnerId,
      name: "Elite Driving School",
      tagline: "Learn to drive with confidence",
      description:
        "Wolverhampton's premier driving school with over 14 fully qualified instructors. We specialise in both manual and automatic lessons with a 92% first-time pass rate.",
      brand_color: "#1e3a5f",
      areas_covered: ["Wolverhampton", "Bilston", "Willenhall", "Wednesfield"],
      phone: "01902 555123",
      email: "info@elitedriving.co.uk",
      website: "https://elitedriving.co.uk",
      status: "active",
    })
    .select("id")
    .single();

  const { data: driverightSchool } = await supabase
    .from("schools")
    .insert({
      owner_id: driverightOwnerId,
      name: "DriveRight Academy",
      tagline: "Your road to success starts here",
      description:
        "Dudley's largest driving school with 22 instructors covering the entire Black Country. Intensive courses and Pay As You Go options available.",
      brand_color: "#1a3d2e",
      areas_covered: ["Dudley", "Stourbridge", "Halesowen", "Brierley Hill"],
      phone: "01384 555456",
      email: "hello@driveright.co.uk",
      website: "https://driveright.co.uk",
      status: "active",
    })
    .select("id")
    .single();

  console.log("✅ Schools created");

  // -- Solo instructor users --
  const daveId = await createUser("dave@drivenow.co.uk", "Instructor123!", "Dave Mitchell", "instructor");
  const priyaId = await createUser("priya@drivenow.co.uk", "Instructor123!", "Priya Anand", "instructor");
  const lindaId = await createUser("linda@drivenow.co.uk", "Instructor123!", "Linda Osei", "instructor");

  // -- School instructor users --
  const sarahId = await createUser("sarah@drivenow.co.uk", "Instructor123!", "Sarah Collins", "instructor");
  const tomId = await createUser("tom@drivenow.co.uk", "Instructor123!", "Tom Barker", "instructor");
  const marcusId = await createUser("marcus@drivenow.co.uk", "Instructor123!", "Marcus James", "instructor");

  // -- Instructor records --
  const instructorRows = [
    { user_id: daveId, school_id: null, adi_number: "ADI-100234", bio: "15 years experience teaching in Wolverhampton. Patient, calm, and focused on getting you test-ready. I teach both manual and automatic.", hourly_rate: 38, transmission: "both", areas_covered: ["Wolverhampton", "Tettenhall", "Penn"], tags: ["ADI Verified", "Pass Plus", "Motorway"], rating_avg: 4.9, review_count: 214, status: "active" },
    { user_id: priyaId, school_id: null, adi_number: "ADI-100567", bio: "Friendly, patient instructor with 8 years experience. I specialise in nervous learners and offer a calm, supportive environment.", hourly_rate: 36, transmission: "both", areas_covered: ["Wolverhampton West", "Tettenhall", "Codsall"], tags: ["ADI Verified", "Nervous Drivers", "Female Instructor"], rating_avg: 4.7, review_count: 143, status: "active" },
    { user_id: lindaId, school_id: null, adi_number: "ADI-100891", bio: "Automatic specialist with a brand new Toyota Yaris. Perfect for learners who want a simpler start.", hourly_rate: 34, transmission: "automatic", areas_covered: ["Wolverhampton East", "Willenhall", "Darlaston"], tags: ["ADI Verified", "Automatic Only"], rating_avg: 4.6, review_count: 77, status: "active" },
    { user_id: sarahId, school_id: eliteSchool?.id, adi_number: "ADI-200123", bio: "Automatic lesson specialist at Elite. 6 years experience, first-time pass rate of 88%.", hourly_rate: 35, transmission: "automatic", areas_covered: ["Wolverhampton", "Bilston"], tags: ["ADI Verified", "Automatic Only"], rating_avg: 4.8, review_count: 92, status: "active" },
    { user_id: tomId, school_id: eliteSchool?.id, adi_number: "ADI-200456", bio: "Senior instructor at Elite Driving School. I specialise in intensive courses and motorway driving.", hourly_rate: 40, transmission: "manual", areas_covered: ["Wolverhampton", "Wednesfield"], tags: ["ADI Verified", "Pass Plus", "Intensive Courses"], rating_avg: 5.0, review_count: 56, status: "active" },
    { user_id: marcusId, school_id: eliteSchool?.id, adi_number: "ADI-200789", bio: "Calm, methodical teaching style. I break down complex manoeuvres into simple steps.", hourly_rate: 37, transmission: "manual", areas_covered: ["Wolverhampton", "Willenhall"], tags: ["ADI Verified", "Mock Test Prep"], rating_avg: 4.9, review_count: 88, status: "active" },
  ];

  const { data: instructors } = await supabase
    .from("instructors")
    .insert(instructorRows)
    .select("id, user_id");

  console.log("✅ Instructors created");

  if (!instructors) {
    console.error("Failed to create instructors");
    return;
  }

  // -- Availability slots --
  const allSlots = instructors.flatMap((inst) => futureSlots(inst.id, 5));
  await supabase.from("availability_slots").insert(allSlots);
  console.log(`✅ ${allSlots.length} availability slots created`);

  // -- Learner users --
  const learner1Id = await createUser("learner1@drivenow.co.uk", "Learner123!", "Emma Watson", "learner");
  const learner2Id = await createUser("learner2@drivenow.co.uk", "Learner123!", "James Chen", "learner");
  const learner3Id = await createUser("learner3@drivenow.co.uk", "Learner123!", "Sophie Taylor", "learner");

  console.log("✅ Learners created");

  // -- Bookings, reviews, lesson logs, progress --
  const learnerConfigs = [
    { id: learner1Id!, name: "Emma Watson", lessonCount: 5, skills: SKILLS.slice(0, 3), masteryBase: 25 },
    { id: learner2Id!, name: "James Chen", lessonCount: 18, skills: SKILLS.slice(0, 6), masteryBase: 55 },
    { id: learner3Id!, name: "Sophie Taylor", lessonCount: 28, skills: SKILLS, masteryBase: 78 },
  ];

  let bookingCount = 0;

  for (const learner of learnerConfigs) {
    for (let i = 0; i < Math.min(learner.lessonCount, 7); i++) {
      const inst = instructors[i % instructors.length];
      const date = randomDate(60);
      const endDate = new Date(date);
      endDate.setHours(date.getHours() + 1);

      const { data: slot } = await supabase
        .from("availability_slots")
        .insert({
          instructor_id: inst.id,
          start_time: date.toISOString(),
          end_time: endDate.toISOString(),
          is_booked: true,
        })
        .select("id")
        .single();

      if (!slot) continue;

      const price = instructorRows.find((r) => r.user_id === inst.user_id)?.hourly_rate || 35;
      const platformFee = Math.round(price * 0.15 * 100) / 100;

      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          learner_id: learner.id,
          instructor_id: inst.id,
          school_id: instructorRows.find((r) => r.user_id === inst.user_id)?.school_id || null,
          slot_id: slot.id,
          lesson_type: "standard_1hr",
          price,
          platform_fee: platformFee,
          instructor_payout: price - platformFee,
          status: "completed",
          payment_method: Math.random() > 0.3 ? "card" : "bank_transfer",
        })
        .select("id")
        .single();

      if (!booking) continue;
      bookingCount++;

      // Review (70% chance)
      if (Math.random() > 0.3) {
        const rating = 4 + Math.floor(Math.random() * 2);
        await supabase.from("reviews").insert({
          booking_id: booking.id,
          learner_id: learner.id,
          instructor_id: inst.id,
          rating,
          comment: reviews[Math.floor(Math.random() * reviews.length)],
        });
      }

      // Lesson log
      const coveredSkills = learner.skills.slice(
        0,
        2 + Math.floor(Math.random() * 3)
      );
      const confidenceRatings: Record<string, number> = {};
      coveredSkills.forEach((skill) => {
        confidenceRatings[skill] = 2 + Math.floor(Math.random() * 4);
      });

      await supabase.from("lesson_logs").insert({
        booking_id: booking.id,
        instructor_id: inst.id,
        learner_id: learner.id,
        maneuvers_covered: coveredSkills,
        confidence_ratings: confidenceRatings,
        notes: i === 0 ? "First lesson — covered basics and got comfortable with controls." : null,
      });
    }

    // Learner progress
    for (const skill of learner.skills) {
      const mastery =
        learner.masteryBase +
        Math.floor(Math.random() * 20) -
        10;
      await supabase.from("learner_progress").upsert(
        {
          learner_id: learner.id,
          skill,
          mastery_level: Math.max(0, Math.min(100, mastery)),
          practice_count: 1 + Math.floor(Math.random() * learner.lessonCount / 2),
          last_practiced_at: randomDate(14).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "learner_id,skill" }
      );
    }
  }

  console.log(`✅ ${bookingCount} bookings created with reviews and lesson logs`);
  console.log("✅ Learner progress seeded");
  console.log("\n🎉 Seed complete!\n");
  console.log("Test accounts:");
  console.log("  Admin:      admin@drivenow.co.uk / Admin123!");
  console.log("  School:     elite@drivenow.co.uk / School123!");
  console.log("  Instructor: dave@drivenow.co.uk / Instructor123!");
  console.log("  Learner:    learner1@drivenow.co.uk / Learner123!");
}

seed().catch(console.error);
