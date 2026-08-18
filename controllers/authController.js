/*
MIT License

Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
Mindoro State University - Philippines
*/

import { auth, db } from "../models/firebaseConfig.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

const fmt = (val) => {
  if (!val) return "—";
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const getInitials = (name = "") =>
  name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

// ─────────────────────────────────────────────
// PAGE RENDERERS
// ─────────────────────────────────────────────

export const loginPage = (req, res) =>
  res.render("login", { title: "Login" });

export const registerPage = (req, res) =>
  res.render("register", { title: "Create Account" });

export const forgotPasswordPage = (req, res) =>
  res.render("forgotpassword", { title: "Reset Password" });

// Dashboard — protected route, passes user profile to view
export const dashboardPage = async (req, res) => {
  if (!req.session.userId) {
    req.flash("error_msg", "Please log in to access the dashboard.");
    return res.redirect("/login");
  }

  try {
    // Fetch the user's Firestore profile so the dashboard can display
    // their name, email, role, etc.
    const userDoc = await getDoc(doc(db, "users", req.session.userId));

    if (!userDoc.exists()) {
      req.flash("error_msg", "User profile not found. Please contact support.");
      return res.redirect("/login");
    }

    const user = userDoc.data();

    // For admin dashboard: load stats + recent users
    let stats = {};
    let recentUsers = [];
    if (user.role === "admin") {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers  = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const casesSnap = await getDocs(collection(db, "cases"));
      const allCases  = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      stats = {
        totalUsers:    allUsers.length,
        totalCases:    allCases.length,
        pendingCases:  allCases.filter(c => c.status === "pending").length,
        approvedCases: allCases.filter(c => c.status === "approved").length,
      };

      recentUsers = allUsers
        .sort((a, b) => {
          const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const db_ = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return db_ - da;
        })
        .slice(0, 5)
        .map(u => ({ ...u, createdAtFormatted: fmt(u.createdAt) }));
    }

    res.render("dashboard", {
      title: "Dashboard",
      user,
      initials: getInitials(user.fullName),
      activePage: "dashboard",
      stats,
      recentUsers
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);
    req.flash("error_msg", "Could not load dashboard. Please try again.");
    res.redirect("/login");
  }
};

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────

export const registerUser = async (req, res) => {
  const { fullName, email, contactNumber, password, role } = req.body;

  // Server-side validation
  if (!fullName || !email || !password) {
    req.flash("error_msg", "Full name, email, and password are required.");
    return res.render("register", {
      title: "Create Account",
      oldInput: { fullName, email, contactNumber, role }
    });
  }

  if (password.length < 6) {
    req.flash("error_msg", "Password must be at least 6 characters long.");
    return res.render("register", {
      title: "Create Account",
      oldInput: { fullName, email, contactNumber, role }
    });
  }

  // Validate PH contact number if provided
  if (contactNumber && !/^09\d{9}$/.test(contactNumber)) {
    req.flash("error_msg", "Enter a valid Philippine mobile number (e.g. 09XXXXXXXXX).");
    return res.render("register", {
      title: "Create Account",
      oldInput: { fullName, email, contactNumber, role }
    });
  }

  try {
    // 1. Create account in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Set display name in Firebase Auth
    await updateProfile(user, { displayName: fullName });

    // 3. Save full profile to Firestore (UID as document ID)
    await setDoc(doc(db, "users", user.uid), {
      fullName:      fullName.trim(),
      email:         email.trim().toLowerCase(),
      contactNumber: contactNumber ? contactNumber.trim() : "",
      role:          "citizen",   // public registration is always citizen
      createdAt:     new Date()
    });

    // 4. Start session
    req.session.userId = user.uid;
    req.flash("success_msg", `Welcome, ${fullName}! Your account has been created.`);
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Registration error:", error.code, error.message);

    let errorMsg = "Registration failed. Please try again.";
    if (error.code === "auth/email-already-in-use") {
      errorMsg = "This email is already registered. Please log in instead.";
    } else if (error.code === "auth/weak-password") {
      errorMsg = "Password is too weak. Use at least 6 characters.";
    } else if (error.code === "auth/invalid-email") {
      errorMsg = "Please enter a valid email address.";
    }

    req.flash("error_msg", errorMsg);
    res.render("register", {
      title: "Create Account",
      oldInput: { fullName, email, contactNumber, role }
    });
  }
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash("error_msg", "Email and password are required.");
    return res.redirect("/login");
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    req.session.userId = userCredential.user.uid;
    req.flash("success_msg", "Logged in successfully. Welcome back!");
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error.code, error.message);

    let errorMsg = "Login failed. Please check your credentials.";
    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/invalid-credential"
    ) {
      errorMsg = "Invalid email or password. Please try again.";
    } else if (error.code === "auth/too-many-requests") {
      errorMsg = "Too many failed attempts. Please wait a few minutes before trying again.";
    } else if (error.code === "auth/user-disabled") {
      errorMsg = "This account has been disabled. Please contact the administrator.";
    }

    req.flash("error_msg", errorMsg);
    res.redirect("/login");
  }
};

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    req.flash("error_msg", "Please enter your email address.");
    return res.redirect("/forgot-password");
  }

  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    // Always show success to avoid leaking whether an email is registered
    req.flash(
      "success_msg",
      "If that email is registered, a password reset link has been sent. Check your inbox."
    );
    res.redirect("/forgot-password");
  } catch (error) {
    console.error("Forgot password error:", error.code, error.message);

    let errorMsg = "Failed to send reset email. Please try again.";
    if (error.code === "auth/invalid-email") {
      errorMsg = "Please enter a valid email address.";
    } else if (error.code === "auth/too-many-requests") {
      errorMsg = "Too many requests. Please wait before trying again.";
    }

    req.flash("error_msg", errorMsg);
    res.redirect("/forgot-password");
  }
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

export const logoutUser = async (req, res) => {
  try {
    await signOut(auth);
    req.session.destroy(() => {
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout error:", error.message);
    req.flash("error_msg", "Logout failed. Please try again.");
    res.redirect("/dashboard");
  }
};
