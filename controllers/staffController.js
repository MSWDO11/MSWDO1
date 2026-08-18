import { db } from "../models/firebaseConfig.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, query, where
} from "firebase/firestore";

const fmt = (val) => {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ── Auth guard — staff or admin allowed ───────────────────────────────────
const requireStaff = async (req, res) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to continue.");
    res.redirect("/login");
    return null;
  }
  const snap = await getDoc(doc(db, "users", req.session.userId));
  if (!snap.exists() || !["staff", "admin"].includes(snap.data().role)) {
    req.flash("error_msg", "Access denied. Staff only.");
    res.redirect("/dashboard");
    return null;
  }
  return { uid: snap.id, ...snap.data() };
};

// ─────────────────────────────────────────────────────────────────────────
// MANAGE CASES — staff view of all cases with status update
// ─────────────────────────────────────────────────────────────────────────
export const staffCasesPage = async (req, res) => {
  const user = await requireStaff(req, res);
  if (!user) return;

  try {
    const statusFilter = req.query.status || "all";
    const casesSnap    = await getDocs(collection(db, "cases"));

    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let cases = allCases;
    if (statusFilter !== "all") {
      cases = cases.filter(c => c.status === statusFilter);
    }

    cases = cases
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return db_ - da;
      })
      .map((c, i) => ({
        ...c,
        index: i + 1,
        createdAtFormatted: fmt(c.createdAt),
        applicantInitials: getInitials(c.applicantName || "?"),
      }));

    res.render("staffcases", {
      title: "Manage Cases",
      user,
      activePage: "staffcases",
      initials: getInitials(user.fullName),
      cases,
      totalCases: cases.length,
      activeFilter: statusFilter,
      pendingCount:  allCases.filter(c => c.status === "pending").length,
      reviewCount:   allCases.filter(c => c.status === "review").length,
      approvedCount: allCases.filter(c => c.status === "approved").length,
      rejectedCount: allCases.filter(c => c.status === "rejected").length,
    });
  } catch (err) {
    console.error("Staff cases error:", err.message);
    req.flash("error_msg", "Could not load cases.");
    res.redirect("/dashboard");
  }
};

// Update case status (staff)
export const staffUpdateCaseStatus = async (req, res) => {
  const user = await requireStaff(req, res);
  if (!user) return;

  const { id } = req.params;
  const { status, notes } = req.body;
  const allowed = ["pending", "review", "approved", "rejected"];

  if (!allowed.includes(status)) {
    req.flash("error_msg", "Invalid status.");
    return res.redirect("/staff/cases");
  }

  try {
    const updateData = { status, updatedAt: new Date(), reviewedBy: user.fullName };
    if (notes && notes.trim()) updateData.notes = notes.trim();
    await updateDoc(doc(db, "cases", id), updateData);
    req.flash("success_msg", `Case status updated to "${status}".`);
    res.redirect("/staff/cases");
  } catch (err) {
    console.error("Staff update case error:", err.message);
    req.flash("error_msg", "Failed to update case.");
    res.redirect("/staff/cases");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// BENEFICIARIES — list of all citizens
// ─────────────────────────────────────────────────────────────────────────
export const beneficiariesPage = async (req, res) => {
  const user = await requireStaff(req, res);
  if (!user) return;

  try {
    const usersSnap  = await getDocs(collection(db, "users"));
    const casesSnap  = await getDocs(collection(db, "cases"));

    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Build a map: uid → case count
    const caseCountMap = {};
    allCases.forEach(c => {
      if (c.applicantUid) {
        caseCountMap[c.applicantUid] = (caseCountMap[c.applicantUid] || 0) + 1;
      }
    });

    const beneficiaries = usersSnap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.role === "citizen")
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return db_ - da;
      })
      .map((u, i) => ({
        ...u,
        index: i + 1,
        initials: getInitials(u.fullName),
        caseCount: caseCountMap[u.uid] || 0,
        createdAtFormatted: fmt(u.createdAt),
      }));

    res.render("beneficiaries", {
      title: "Beneficiaries",
      user,
      activePage: "beneficiaries",
      initials: getInitials(user.fullName),
      beneficiaries,
      totalBeneficiaries: beneficiaries.length,
    });
  } catch (err) {
    console.error("Beneficiaries error:", err.message);
    req.flash("error_msg", "Could not load beneficiaries.");
    res.redirect("/dashboard");
  }
};
