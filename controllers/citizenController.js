import { db } from "../models/firebaseConfig.js";
import {
  collection, addDoc, getDocs, query,
  where, orderBy, doc, getDoc
} from "firebase/firestore";

const fmt = (val) => {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ── Auth guard ─────────────────────────────────────────────────────────────
const requireCitizen = async (req, res) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to continue.");
    res.redirect("/login");
    return null;
  }
  const snap = await getDoc(doc(db, "users", req.session.userId));
  if (!snap.exists()) {
    req.flash("error_msg", "User profile not found.");
    res.redirect("/login");
    return null;
  }
  return { uid: snap.id, ...snap.data() };
};

// ── Assistance types available ─────────────────────────────────────────────
export const ASSISTANCE_TYPES = [
  "Financial Assistance",
  "Medical Assistance",
  "Burial Assistance",
  "Educational Assistance",
  "Food Assistance",
  "Livelihood Assistance",
  "Legal Assistance",
  "Psychosocial Support",
  "Senior Citizen Assistance",
  "Person with Disability (PWD) Assistance",
  "Solo Parent Assistance",
  "Other",
];

// ─────────────────────────────────────────────────────────────────────────
// APPLY — GET
// ─────────────────────────────────────────────────────────────────────────
export const applyPage = async (req, res) => {
  const user = await requireCitizen(req, res);
  if (!user) return;
  res.render("apply", {
    title: "Apply for Assistance",
    user,
    activePage: "apply",
    initials: getInitials(user.fullName),
    assistanceTypes: ASSISTANCE_TYPES,
  });
};

// ─────────────────────────────────────────────────────────────────────────
// APPLY — POST (submit application)
// ─────────────────────────────────────────────────────────────────────────
export const submitApplication = async (req, res) => {
  const user = await requireCitizen(req, res);
  if (!user) return;

  const { assistanceType, description, address, contactNumber } = req.body;

  if (!assistanceType || !description || !address) {
    req.flash("error_msg", "Please fill in all required fields.");
    return res.redirect("/apply");
  }

  try {
    await addDoc(collection(db, "cases"), {
      applicantName:   user.fullName,
      applicantEmail:  user.email,
      applicantUid:    req.session.userId,
      assistanceType:  assistanceType.trim(),
      description:     description.trim(),
      address:         address.trim(),
      contactNumber:   contactNumber ? contactNumber.trim() : user.contactNumber || "",
      status:          "pending",
      createdAt:       new Date(),
      updatedAt:       new Date(),
    });

    req.flash("success_msg", "Application submitted successfully! We will review it shortly.");
    res.redirect("/my-cases");
  } catch (err) {
    console.error("Submit application error:", err.message);
    req.flash("error_msg", "Failed to submit application. Please try again.");
    res.redirect("/apply");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MY CASES — citizen's own applications
// ─────────────────────────────────────────────────────────────────────────
export const myCasesPage = async (req, res) => {
  const user = await requireCitizen(req, res);
  if (!user) return;

  try {
    const q = query(
      collection(db, "cases"),
      where("applicantUid", "==", req.session.userId)
    );
    const snap = await getDocs(q);

    const cases = snap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAtFormatted: fmt(d.data().createdAt) }))
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return db_ - da;
      })
      .map((c, i) => ({ ...c, index: i + 1 }));

    const pending  = cases.filter(c => c.status === "pending").length;
    const review   = cases.filter(c => c.status === "review").length;
    const approved = cases.filter(c => c.status === "approved").length;
    const rejected = cases.filter(c => c.status === "rejected").length;

    res.render("mycases", {
      title: "My Applications",
      user,
      activePage: "mycases",
      initials: getInitials(user.fullName),
      cases,
      totalCases: cases.length,
      pending,
      review,
      approved,
      rejected,
    });
  } catch (err) {
    console.error("My cases error:", err.message);
    req.flash("error_msg", "Could not load your applications.");
    res.redirect("/dashboard");
  }
};
