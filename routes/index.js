
  /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import express from "express";
import { homePage } from "../controllers/homeController.js";
const router = express.Router();
router.get("/", homePage);

import { loginPage, registerPage, forgotPasswordPage, dashboardPage, loginUser, registerUser, logoutUser, forgotPassword } from "../controllers/authController.js";

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/forgot-password", forgotPasswordPage);
router.post("/forgot-password", forgotPassword);
router.get("/dashboard", dashboardPage);
router.get("/logout", logoutUser);

import {
  reportsPage,
  allUsersPage,
  allCasesPage,
  updateCaseStatus,
  settingsPage,
  updateProfile,
  updatePasswordHandler
} from "../controllers/adminController.js";

// Admin routes
router.get("/admin/reports",               reportsPage);
router.get("/admin/users",                 allUsersPage);
router.get("/admin/cases",                 allCasesPage);
router.post("/admin/cases/:id/status",     updateCaseStatus);
router.get("/admin/settings",              settingsPage);
router.post("/admin/settings/profile",     updateProfile);
router.post("/admin/settings/password",    updatePasswordHandler);

import {
  applyPage,
  submitApplication,
  myCasesPage,
} from "../controllers/citizenController.js";

// Citizen routes
router.get("/apply",     applyPage);
router.post("/apply",    submitApplication);
router.get("/my-cases",  myCasesPage);

import {
  staffCasesPage,
  staffUpdateCaseStatus,
  beneficiariesPage,
} from "../controllers/staffController.js";

// Staff routes
router.get("/staff/cases",                  staffCasesPage);
router.post("/staff/cases/:id/status",      staffUpdateCaseStatus);
router.get("/staff/beneficiaries",          beneficiariesPage);

export default router;
