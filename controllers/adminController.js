import { db, auth } from "../models/firebaseConfig.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy
} from "firebase/firestore";
import { updatePassword } from "firebase/auth";

// ── Auth guard helper ──────────────────────────────────────────────────────
const requireAdmin = async (req, res) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to continue.");
    res.redirect("/login");
    return null;
  }
  const snap = await getDoc(doc(db, "users", req.session.userId));
  if (!snap.exists() || snap.data().role !== "admin") {
    req.flash("error_msg", "Access denied. Admins only.");
    res.redirect("/dashboard");
    return null;
  }
  return { uid: snap.id, ...snap.data() };
};

// ── Format Firestore Timestamp or Date ────────────────────────────────────
const fmt = (val) => {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

// ── Build initials from fullName ──────────────────────────────────────────
const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ── Percentage helper ─────────────────────────────────────────────────────
const pct = (part, total) => (total === 0 ? 0 : Math.round((part / total) * 100));

// ─────────────────────────────────────────────────────────────────────────
// REPORTS & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────
export const reportsPage = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    // Fetch all users
    const usersSnap = await getDocs(collection(db, "users"));
    const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

    const totalUsers = allUsers.length;
    const citizens   = allUsers.filter(u => u.role === "citizen").length;
    const staff      = allUsers.filter(u => u.role === "staff").length;
    const admins     = allUsers.filter(u => u.role === "admin").length;

    // Fetch all cases
    const casesSnap = await getDocs(collection(db, "cases"));
    const allCases  = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const totalCases    = allCases.length;
    const pendingCases  = allCases.filter(c => c.status === "pending").length;
    const reviewCases   = allCases.filter(c => c.status === "review").length;
    const approvedCases = allCases.filter(c => c.status === "approved").length;
    const rejectedCases = allCases.filter(c => c.status === "rejected").length;

    // 5 most recently registered users
    const recentUsers = allUsers
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return db_ - da;
      })
      .slice(0, 5)
      .map(u => ({
        ...u,
        initials: getInitials(u.fullName),
        createdAtFormatted: fmt(u.createdAt)
      }));

    res.render("reports", {
      title: "Reports & Analytics",
      user,
      activePage: "reports",
      initials: getInitials(user.fullName),
      recentUsers,
      stats: {
        totalUsers, citizens, staff, admins,
        citizenPct: pct(citizens, totalUsers),
        staffPct:   pct(staff,    totalUsers),
        adminPct:   pct(admins,   totalUsers),
        totalCases, pendingCases, reviewCases, approvedCases, rejectedCases,
        pendingPct:  pct(pendingCases,  totalCases),
        reviewPct:   pct(reviewCases,   totalCases),
        approvedPct: pct(approvedCases, totalCases),
        rejectedPct: pct(rejectedCases, totalCases),
      }
    });
  } catch (err) {
    console.error("Reports error:", err.message);
    req.flash("error_msg", "Could not load reports.");
    res.redirect("/dashboard");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ALL USERS
// ─────────────────────────────────────────────────────────────────────────
export const allUsersPage = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const roleFilter = req.query.role || "all";
    const usersSnap  = await getDocs(collection(db, "users"));

    let users = usersSnap.docs.map((d, i) => ({
      index: i + 1,
      uid: d.id,
      ...d.data(),
      initials: getInitials(d.data().fullName),
      createdAtFormatted: fmt(d.data().createdAt)
    }));

    if (roleFilter !== "all") {
      users = users.filter(u => u.role === roleFilter);
    }

    // Always compute full counts regardless of filter for the summary cards
    const allForCount = usersSnap.docs.map(d => d.data());

    res.render("allusers", {
      title: "All Users",
      user,
      activePage: "users",
      initials: getInitials(user.fullName),
      users,
      totalUsers: users.length,
      activeFilter: roleFilter,
      citizenCount: allForCount.filter(u => u.role === "citizen").length,
      staffCount:   allForCount.filter(u => u.role === "staff").length,
      adminCount:   allForCount.filter(u => u.role === "admin").length,
    });
  } catch (err) {
    console.error("All users error:", err.message);
    req.flash("error_msg", "Could not load users.");
    res.redirect("/dashboard");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ALL CASES
// ─────────────────────────────────────────────────────────────────────────
export const allCasesPage = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const statusFilter = req.query.status || "all";
    const casesSnap    = await getDocs(collection(db, "cases"));

    let cases = casesSnap.docs.map((d, i) => ({
      index: i + 1,
      id: d.id,
      ...d.data(),
      createdAtFormatted: fmt(d.data().createdAt)
    }));

    if (statusFilter !== "all") {
      cases = cases.filter(c => c.status === statusFilter);
    }

    // Always compute full counts regardless of filter for the summary cards
    const allCasesForCount = casesSnap.docs.map(d => d.data());

    // Add applicant initials for avatar
    cases = cases.map(c => ({
      ...c,
      applicantInitials: (c.applicantName || "?")
        .split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("")
    }));

    res.render("allcases", {
      title: "All Cases",
      user,
      activePage: "cases",
      initials: getInitials(user.fullName),
      cases,
      totalCases: cases.length,
      activeFilter: statusFilter,
      pendingCount:  allCasesForCount.filter(c => c.status === "pending").length,
      reviewCount:   allCasesForCount.filter(c => c.status === "review").length,
      approvedCount: allCasesForCount.filter(c => c.status === "approved").length,
      rejectedCount: allCasesForCount.filter(c => c.status === "rejected").length,
    });
  } catch (err) {
    console.error("All cases error:", err.message);
    req.flash("error_msg", "Could not load cases.");
    res.redirect("/dashboard");
  }
};

// Update case status
export const updateCaseStatus = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["pending", "review", "approved", "rejected"];

  if (!allowed.includes(status)) {
    req.flash("error_msg", "Invalid status value.");
    return res.redirect("/admin/cases");
  }

  try {
    await updateDoc(doc(db, "cases", id), { status, updatedAt: new Date() });
    req.flash("success_msg", `Case status updated to "${status}".`);
    res.redirect("/admin/cases");
  } catch (err) {
    console.error("Update case error:", err.message);
    req.flash("error_msg", "Failed to update case status.");
    res.redirect("/admin/cases");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────
export const settingsPage = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // Build initials from fullName (e.g. "Juan Dela Cruz" → "JD")
  const initials = (user.fullName || "A")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");

  res.render("settings", {
    title: "Settings",
    user: { ...user, createdAtFormatted: fmt(user.createdAt) },
    activePage: "settings",
    initials: getInitials(user.fullName)
  });
};

// Update profile (fullName, contactNumber)
export const updateProfile = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { fullName, contactNumber } = req.body;

  if (!fullName || fullName.trim() === "") {
    req.flash("error_msg", "Full name is required.");
    return res.redirect("/admin/settings");
  }

  if (contactNumber && !/^09\d{9}$/.test(contactNumber)) {
    req.flash("error_msg", "Enter a valid Philippine mobile number (09XXXXXXXXX).");
    return res.redirect("/admin/settings");
  }

  try {
    await updateDoc(doc(db, "users", req.session.userId), {
      fullName: fullName.trim(),
      contactNumber: contactNumber ? contactNumber.trim() : ""
    });
    req.flash("success_msg", "Profile updated successfully.");
    res.redirect("/admin/settings");
  } catch (err) {
    console.error("Update profile error:", err.message);
    req.flash("error_msg", "Failed to update profile.");
    res.redirect("/admin/settings");
  }
};

// Change password
export const updatePasswordHandler = async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    req.flash("error_msg", "Password must be at least 6 characters.");
    return res.redirect("/admin/settings");
  }

  if (newPassword !== confirmPassword) {
    req.flash("error_msg", "Passwords do not match.");
    return res.redirect("/admin/settings");
  }

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user found.");
    await updatePassword(currentUser, newPassword);
    req.flash("success_msg", "Password updated successfully.");
    res.redirect("/admin/settings");
  } catch (err) {
    console.error("Update password error:", err.message);
    req.flash("error_msg", "Failed to update password. Please log out and log back in, then try again.");
    res.redirect("/admin/settings");
  }
};
