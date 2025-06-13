# Next Phase Design Document: Intelligent Personalized Email Marketing System V1.2

**Version:** 1.0 (of this document)
**Date:** 2024-08-23

## Table of Contents
1.  [Introduction](#1-introduction)
2.  [Completion of V1.1 Features](#2-completion-of-v11-features)
    *   [2.1. Frontend: Campaign Creation & Management](#21-frontend-campaign-creation--management)
    *   [2.2. Frontend: Campaign Analytics Display](#22-frontend-campaign-analytics-display)
    *   [2.3. Final Polish, Documentation & Deployment Prep for V1.1](#23-final-polish-documentation--deployment-prep-for-v11)
    *   [2.4. Backend: Production-Ready SES Webhook Signature Verification](#24-backend-production-ready-ses-webhook-signature-verification)
3.  [Proposed Features for V1.2 Development Phase](#3-proposed-features-for-v12-development-phase)
    *   [3.1. Core Feature: Advanced Contact Segmentation](#31-core-feature-advanced-contact-segmentation)
    *   [3.2. Core Feature: Interactive Dashboard](#32-core-feature-interactive-dashboard)
    *   [3.3. Enhancement: User Password Reset Functionality](#33-enhancement-user-password-reset-functionality)
    *   [3.4. Enhancement: Dynamic "Insert Variable" in Template Editor](#34-enhancement-dynamic-insert-variable-in-template-editor)
    *   [3.5. Stretch Goal: A/B Testing for Campaigns](#35-stretch-goal-ab-testing-for-campaigns)
4.  [Technical Considerations for V1.2](#4-technical-considerations-for-v12)
5.  [Proposed Roadmap for V1.2 (High-Level)](#5-proposed-roadmap-for-v12-high-level)

---

## 1. Introduction

### 1.1. Purpose
This document outlines the remaining tasks required to complete the V1.1 feature set for the Intelligent Personalized Email Marketing System, as defined in `Next_Phase_Design_V1.md`. It also proposes a set of features and enhancements for the subsequent V1.2 development phase, building upon the V1.1 foundation.

### 1.2. Current System Status (Post-Partial V1.1 Implementation)
Significant progress has been made on V1.1:
*   **Backend integrations:** Real AWS SES (sending and basic webhook handling) and OpenAI API integrations are complete.
*   **Frontend development (React):**
    *   Core application structure with Redux, React Router, and Ant Design is in place.
    *   User Authentication (Login, Registration) is functional.
    *   Contact Management (CRUD, CSV/Excel import) is implemented.
    *   Email Template Editor (TinyMCE, CRUD, static "Insert Variable", AI Assistant) is implemented.

The SES webhook signature verification currently uses a placeholder and needs to be upgraded for production security. The remaining V1.1 frontend sprints focus on Campaign Management and Analytics.

---

## 2. Completion of V1.1 Features

The following tasks from the original V1.1 plan remain to be completed.

### 2.1. Frontend: Campaign Creation & Management
(Corresponds to V1.1 Sprint 7-8)
*   **2.1.1. Campaign Listing Page:**
    *   Display campaigns with status indicators (draft, scheduled, sending, sent, failed).
    *   Actions: Edit, Delete, View Report (links to analytics page), Clone (optional).
    *   Search and filtering capabilities for campaigns.
*   **2.1.2. Multi-Step Campaign Creation/Editing Wizard (React Components):**
    *   **Step 1: Setup:** Campaign Name, Subject Line.
    *   **Step 2: Recipients:**
        *   UI to select recipient group (e.g., "All Contacts", specific contacts selected from a list/search).
        *   (Future V1.2: Integrate segment selection here).
    *   **Step 3: Template Selection:**
        *   UI to list and select from available, user-created email templates.
        *   Preview of selected template (static preview for now).
    *   **Step 4: Review & Schedule:**
        *   Summary of campaign details.
        *   Options to "Send Now" or "Schedule for Later" (with datetime picker).
        *   Dynamic email preview with sample data from selected contacts/template (stretch for V1.1, basic preview is fine).
    *   **API Integration:** Connect wizard to backend `CampaignViewSet` for creating/updating campaigns and triggering `send_now` or `schedule_campaign` actions. Display feedback.

### 2.2. Frontend: Campaign Analytics Display
(Corresponds to V1.1 Sprint 9)
*   **2.2.1. Campaign Report Page (React Components):**
    *   Fetch and display statistics from the `/api/campaigns/<pk>/stats/` endpoint.
    *   Key Metrics: Total Sent, Delivered, Opened, Clicked, Bounced, Unsubscribed (if tracked). Rates: Open Rate, Click-Through Rate (CTR), Bounce Rate, Unsubscribe Rate.
    *   **Data Visualization:** Implement interactive charts (e.g., using Chart.js or a React charting library) to visualize:
        *   Overall campaign performance (e.g., pie chart of delivered/bounced/opened).
        *   Open/Click trends over time (if hourly/daily data is available from analytics).
*   **2.2.2. Testing:** Focus on integration testing for campaign creation and analytics display workflows.

### 2.3. Final Polish, Documentation & Deployment Prep for V1.1
(Corresponds to V1.1 Sprint 10)
*   UI/UX refinements across the application based on internal review.
*   Comprehensive testing (unit, integration, consider key E2E flows).
*   Bug fixing.
*   Update user/developer documentation for V1.1 features.
*   Prepare frontend and backend for V1.1 deployment (build scripts, environment variable checks, etc.).

### 2.4. Backend: Production-Ready SES Webhook Signature Verification
*   Replace the current placeholder ECDSA signature verification in `SESWebhookView` with a robust RSA-based verification mechanism using a library like `cryptography` or `python-rsa` to securely validate incoming SNS messages.

---

## 3. Proposed Features for V1.2 Development Phase

### 3.1. Core Feature: Advanced Contact Segmentation
(Originally an optional/stretch goal for V1.1)
*   **3.1.1. UI for Defining Segmentation Rules (React):**
    *   Allow users to build segment rules based on contact fields (standard and custom), email activity (opens, clicks for specific campaigns), list membership, etc.
    *   Example rules: "Contacts where `city` is 'New York' AND opened Campaign X", "Contacts added in the last 30 days".
*   **3.1.2. Backend Logic for Evaluating Segments (Django):**
    *   Develop efficient Django QuerySet logic or custom functions to evaluate segment rules.
    *   Store segment definitions.
    *   Calculate segment membership dynamically or periodically.
*   **3.1.3. Integration:** Use segments in Campaign Creation Wizard for recipient selection.

### 3.2. Core Feature: Interactive Dashboard
*   **3.2.1. Dashboard Page (React):**
    *   Central landing page after login.
    *   **Key Widgets:**
        *   Overall account statistics (total contacts, total emails sent, average open/click rates).
        *   Recent campaign performance summaries (clickable to full report).
        *   Upcoming scheduled campaigns.
        *   Contact growth chart.
        *   Quick access to "Create Campaign", "Add Contacts", "Create Template".

### 3.3. Enhancement: User Password Reset Functionality
*   Implement a secure password reset flow:
    *   "Forgot Password" link on login page.
    *   Endpoint to request password reset (sends email with unique token).
    *   Page to enter new password using the token.
    *   Backend logic for token generation, validation, and password update. (Likely using `dj_rest_auth` or `djoser` capabilities if added, or custom implementation).

### 3.4. Enhancement: Dynamic "Insert Variable" in Template Editor
*   Modify the "Insert Variable" feature in the Email Template Editor:
    *   Fetch available contact attributes (including custom field keys defined by the user) from the backend.
    *   Dynamically populate the dropdown list with these variables, e.g., `{{custom_fields.user_defined_key}}`.

### 3.5. Stretch Goal: A/B Testing for Campaigns
*   **3.5.1. Campaign Setup:** Allow creating two or more versions (A, B, ...) of a campaign, varying subject lines or email content.
*   **3.5.2. Sending Logic:** Split a portion of the recipient list to receive each version.
*   **3.5.3. Analytics:** Track and compare performance (opens, clicks) for each version to determine the winner.
*   **3.5.4. UI:** Display A/B test results and allow sending the winning version to the rest of the list (optional).

---

## 4. Technical Considerations for V1.2
*   **API Design:** New endpoints will be required for segmentation (CRUD for segment definitions, evaluating segments), dashboard data, and potentially A/B testing setup. Password reset will need new auth endpoints.
*   **Database Schema:** May need new models for Segments, A/B Test variations.
*   **Performance:** Evaluating complex segments on large contact lists needs to be optimized. Dashboard queries should be efficient.
*   **Testing:** New features will require comprehensive unit, integration, and E2E tests.

---

## 5. Proposed Roadmap for V1.2 (High-Level)

This assumes completion of V1.1 tasks first.

*   **Sprint 1-2 (V1.2): Advanced Contact Segmentation - Backend & Basic UI**
    *   Backend models and API for segment definition and evaluation.
    *   Initial React UI for creating simple segment rules.
*   **Sprint 3 (V1.2): Advanced Contact Segmentation - UI Polish & Integration**
    *   Refine segmentation UI.
    *   Integrate segment selection into campaign creation.
*   **Sprint 4-5 (V1.2): Dashboard & Password Reset**
    *   Develop Dashboard page components and backend API.
    *   Implement password reset functionality (frontend and backend).
*   **Sprint 6 (V1.2): Template Editor Enhancements & A/B Testing Foundation**
    *   Implement dynamic "Insert Variable" feature.
    *   Backend and data model design for A/B testing.
*   **Sprint 7+ (V1.2): A/B Testing Implementation / Other Features / Polish**
    *   Full A/B testing UI and logic.
    *   Buffer for UI/UX polish, bug fixing, and further V1.2 features.

This roadmap is tentative and will be refined based on progress and priorities.
```
