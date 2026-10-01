# Analytics & Decision Support System Specifications (Military School Context)

This document outlines the detailed specifications for the Analytics & Decision Support Portal, including data requirements, explicit mappings between data items and chart types, exact data sources (SIMRS vs. e-Lat), and their placement within the UI layout for each analytical view.

> **Context:** This specification is adapted for a **military school** environment. The two primary data systems are:
> - **SIMRS** *(Student Information & Registration Management System)* — the military equivalent of AIS, managing cadet records, academic standings, scheduling, and administrative data.
> - **e-Lat** *(e-Learning & Training)* — the military equivalent of LMS, managing digital learning modules, training materials, assessments, and cadet engagement.

> [!NOTE]
> All chart types in this document have been validated for compatibility with **Apache Superset**. Where the originally intended visualization is not natively supported by Superset, a functionally equivalent Superset-compatible alternative has been substituted and noted.

---

## Table of Contents
1. [Analytics & Decision Support Portal](#1-analytics--decision-support-portal)
2. [Integrated Data Analysis](#2-integrated-data-analysis)
3. [Decision Support Dashboard](#3-decision-support-dashboard)
4. [Executive Decision View](#4-executive-decision-view)
5. [Operational Decision View](#5-operational-decision-view)
6. [Trend Analysis](#6-trend-analysis)
7. [Historical Analysis](#7-historical-analysis)
8. [Readiness Analysis](#8-readiness-analysis)
9. [Performance Analysis](#9-performance-analysis)
10. [Assessment Analytics](#10-assessment-analytics)
11. [Attendance Analytics](#11-attendance-analytics)
12. [Participation Analytics](#12-participation-analytics)

---

## 1. Analytics & Decision Support Portal

* **Data Required from SIMRS:** User role/permissions (Instructor, Platoon Commander, Leadership), current training period dates, cadet academic & physical standing statuses, global broadcast alerts (e.g., schedule changes, special orders).
* **Data Required from e-Lat:** Count of ungraded assignments/exercises, unread messages from instructors, recent module/subject announcements.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Cadet academic & physical standing summary and remedial/probation counts | **SIMRS** (Academic & physical standing statuses, remedial records) | **Big Number Scorecards** (with Red/Yellow/Green status indicators) | Top Row (Horizontal "Big Number" Scorecards) |
| Ungraded assignments/exercises & instructor grading pending tasks | **e-Lat** (Ungraded assignment counts, instructor task queues) | **Pie Chart** (donut mode, completion percentages) | Main Body (Modular Drag-and-Drop Grid Column 1) |
| Cadet engagement & training module activity trends | **e-Lat** (Weekly active time, module access logs) | **Big Number with Trendline** *(replaces Sparklines; one panel per key metric showing value + mini trend line)* | Main Body (Modular Drag-and-Drop Grid Column 2) |
| System-wide alerts & global broadcasts (e.g., *"Final Exam opens in 48 hours"*) | **SIMRS & e-Lat** (Exam/training schedule dates, system announcements) | **Filtered & Sorted Table** with color-coded status badges *(replaces Notification Badge / Action List Cards; rows sorted by urgency, badge column color-coded by priority)* | Persistent Slide-Out Right Panel |

---

## 2. Integrated Data Analysis

* **Data Required from SIMRS:** Scholarship/financial assistance status, demographic markers (class batch, corps/branch, region of origin), declared specialization track (branch of service), current cumulative GPA and physical fitness score.
* **Data Required from e-Lat:** Login timestamps, total engagement time in minutes, module completion rates.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Dimension controls (Axis selection for assistance status, branch of service, GPA vs e-Lat engagement) | **SIMRS** (Branch of service, GPA, Financial Assistance) + **e-Lat** (Engagement Mins) | **Dashboard Native Filters** (filter dropdowns) | Left 25% (Vertical Control Pane) |
| Scholarship dependency vs. average weekly e-Lat engagement time (identifying at-risk cadets) | **SIMRS** (Financial Assistance Status) + **e-Lat** (Weekly Engagement Mins) | **Scatter Chart** (Correlation analysis) | Right 75% (Top Section of Main Interactive Canvas) |
| Correlation incorporating 3rd variable (e.g., class size or GPA alongside assistance vs. engagement) | **SIMRS** (GPA, Class Size) + **e-Lat** (Engagement Mins) | **Bubble Chart** | Right 75% (Toggle view on Main Interactive Canvas) |
| Engagement patterns across modules/days of training week | **e-Lat** (Daily login timestamps, module completion logs) | **Heatmap** | Right 75% (Alternative View / Detail Section of Canvas) |
| Underlying cadet-level detailed metrics | **SIMRS** (Cadet profile, Branch of Service, GPA) + **e-Lat** (Total engagement time) | **Table** (sortable) | Right 75% (Bottom Section below Canvas) |

---

## 3. Decision Support Dashboard

* **Data Required from SIMRS:** Mid-training evaluation grades, missed mentoring/counseling appointments, outstanding administrative obligations (e.g., incomplete equipment returns).
* **Data Required from e-Lat:** Recent sharp drops in assignment submissions, prolonged absences from training modules.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Prioritized top 25 cadets with >80% predictive probability of academic/training failure + *"Schedule Intervention"* action button | **SIMRS** (Mid-training grades, missed counseling) + **e-Lat** (Assignment submission drops) | **Table** (sorted by risk score descending, with color-coded risk badge column) | Main Body (Primary Action-Oriented Workflow View) |
| Predictive failure/dropout risk levels & threshold indicators | **SIMRS & e-Lat** (Combined predictive AI model outputs) | **Gauge Chart** (Risk Levels) | Expandable Right Side Panel (Top Section) |
| Target vs. actual training performance indicators (grades, submission rates, physical scores) | **SIMRS** (Target vs actual grades & physical scores) + **e-Lat** (Submission rates) | **Grouped Bar Chart** (actual bar vs. target bar side-by-side per metric) *(replaces Bullet Graphs, which are not natively supported in Superset)* | Expandable Right Side Panel (Middle Section) |
| Logical rule path justifying recommendation (e.g., missed counseling + dropped grades + low physical score) | **SIMRS** (Counseling records, mid-training grades) + **e-Lat** (Absence logs) | **Color-coded Rule Summary Table** (columns = risk conditions, rows = cadets, cells = triggered/not triggered badges) *(replaces Decision Tree Visualization, which is not natively supported in Superset)* | Expandable Right Side Panel (Bottom Section) |

---

## 4. Executive Decision View

* **Data Required from SIMRS:** Aggregate cadet registration/enrollment counts per program (Basic Training, Officer Candidate School, Advanced Training), training budget utilization totals, historical cohort enrollment data, accreditation and certification tracking statuses.
* **Data Required from e-Lat:** *(Minimal)* Aggregate system adoption rates across different corps/departments.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Current training period total cadet enrollment against targets, YTD training budget utilization, and first-year cadet retention rates | **SIMRS** (Enrollment counts, budget utilization totals, retention records) | **Big Number Scorecards** (with % change indicators) | Top Header / Row 1 (High Contrast Layout) |
| Geographic distribution of cadet origins (region/province) | **SIMRS** (Cadet home address, province of origin, regional command area) | **Country Map** / Deck.gl Polygon (Choropleth) | Main Body (Left Grid Widget) |
| Training budget and enrollment breakdown across corps/branch of service | **SIMRS** (Budget utilization, corps/branch breakdown) + **e-Lat** (Adoption rates) | **Bar Chart** (stacked mode) | Main Body (Right Grid Widget) |

---

## 5. Operational Decision View

* **Data Required from SIMRS:** Real-time subject registration and class capacity numbers, classroom/hall scheduling and capacity matrix, physical training field allocation.
* **Data Required from e-Lat:** Active concurrent users on the platform, server latency, and uptime metrics.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Daily classroom/hall seat utilization & server load capacity limits | **SIMRS** (Classroom/hall seat capacity) + **e-Lat** (Server load limits) | **Bar Chart** (Actual usage vs. maximum capacity) | Top Widget Row (Command Center Grid) |
| Real-time subject registration progress towards target enrollment per class | **SIMRS** (Live subject registration logs) | **Horizontal Bar Chart** (actual enrollment vs. target capacity per class) *(replaces Progress Bars, which are not natively supported in Superset)* | Header / Summary Bar |
| Live concurrent users, server latency, and system uptime | **e-Lat** (Active session telemetry, server uptime logs) | **Line Chart** (with dashboard auto-refresh) | Middle Grid Section |
| Real-time waitlist counts for bottleneck foundational subjects | **SIMRS** (Waitlist counts, subject registration queues) | **Table** (sortable, with color-coded status badges) | Main Lower Command Center View (Auto-refreshes every few minutes) |

---

## 6. Trend Analysis

* **Data Required from SIMRS:** Historical corps/branch selection and credit hours generated per department over 10+ semesters/batches.
* **Data Required from e-Lat:** Historical shifts in training delivery methods (online vs. hybrid vs. on-site/field modules).

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| 5-year trajectory comparing shifts in branch/corps selection (e.g., declining infantry vs. surging cyber/signal corps registrations) | **SIMRS** (Historical branch declarations over 10+ semesters/batches) | **Line Chart** (multi-series) | Center Main Stage (Wide Horizontal Layout) |
| Credit hour volume over time across departments/subject areas | **SIMRS** (Departmental credit hours generated) | **Area Chart** | Main Canvas (View Toggle Option) |
| Cumulative positive/negative shifts in branch/specialization declarations | **SIMRS** (Branch transfer/selection shifts) | **Grouped Bar Chart** (positive delta vs. negative delta columns, color-coded green/red) *(replaces Waterfall Chart, which is not natively supported in Superset)* | Main Canvas (View Toggle Option) |
| Timeframe zoom controller (semester/batch/year) | **SIMRS & e-Lat** (Semester/Batch/Year timeline metadata) | **Dashboard Native Date Range Filter** *(replaces Master Timeline Slider, which is not natively supported in Superset)* | Bottom persistent filter bar under the main chart |

---

## 7. Historical Analysis

* **Data Required from SIMRS:** Graduated cadet records, demographic flags (class batch, gender, region of origin, corps), intake year, and graduation/commission dates.
* **Data Required from e-Lat:** Historical aggregate training module outcomes and completion rates.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Side-by-side comparison of on-time graduation rates (Batch 2018 vs. Batch 2019 cohorts isolated by region of origin) | **SIMRS** (Graduated records, intake year, demographic flags) | **Bar Chart** (grouped mode) | Upper Half of Split View (Dataset A on Left 50% vs. Dataset B on Right 50%) |
| Cadet flow, retention, and attrition points over the full training period | **SIMRS** (Cohort retention & commission records) + **e-Lat** (Aggregate training module outcomes) | **Sankey Chart** | Lower Half of Split View (Dataset A on Left 50% vs. Dataset B on Right 50%) |

---

## 8. Readiness Analysis

* **Data Required from SIMRS:** Cadet training transcripts, prerequisite subject logic tree, instructor credential database and qualification records.
* **Data Required from e-Lat:** Pre-assessment or placement test scores completed before training period start.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Percentage of enrolled cadets in Advanced Subject A completing prerequisite Subject C (grade C or better) | **SIMRS** (Cadet transcripts & prerequisite logic tree) | **Big Number with Gauge Chart** (percentage value with gauge arc) *(replaces Radial Progress Bar, which is not natively supported in Superset)* | Top Overview / Summary Card |
| Mapping cadet incoming competencies vs. required subject learning objectives | **SIMRS** (Transcripts) + **e-Lat** (Pre-assessment/placement test scores) | **Radar Chart** | Matrix Panel Side Widget |
| Prerequisites and accreditation/certification requirements fulfillment per cadet/instructor | **SIMRS** (Prerequisite tree & instructor qualification records) + **e-Lat** (Placement test completions) | **Pivot Table** (rows = entities, columns = requirements, values = fulfillment status) *(replaces Matrix Grid View; conditional color formatting applied to status values)* | Central Matrix Workspace |

---

## 9. Performance Analysis

* **Data Required from SIMRS:** Final grades, training withdrawal/dropout timestamps, instructor assignments per subject section, and physical fitness test scores.
* **Data Required from e-Lat:** Aggregated teaching evaluation scores and end-of-period cadet survey results.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| DFW-equivalent (Drop/Fail/Withdraw) rate for a foundational subject (e.g., Basic Tactics 101) compared across 5 instructors | **SIMRS** (Final grades, withdrawal timestamps, instructor section assignments) | **Box Plot** (shows grade variance & outliers) | Primary View of Tiered Drill-Down (Drills from Department → Subject Area → Subject → Section) |
| Grade distribution per section/instructor | **SIMRS** (Final grade distributions per section) | **Histogram** | Detail Section in Tiered Drill-Down |
| End-of-period cadet teaching evaluation scores per instructor | **e-Lat** (Aggregated teaching evaluation survey scores) | **Bar Chart** (horizontal mode) | Side-by-side comparison card in Section Drill-Down |

---

## 10. Assessment Analytics

* **Data Required from SIMRS:** Official cadet subject roster.
* **Data Required from e-Lat:** Question banks, individual cadet test responses, time spent per question, rubric criteria scores.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Class score distribution on mid-training exam | **SIMRS** (Official roster) + **e-Lat** (Individual test response scores) | **Histogram** *(replaces Bell Curve / Distribution Chart; approximates the score distribution shape)* | Top Half (Split-Horizontal View) |
| Exam item analysis (e.g., alert showing 82% selected identical distractor on Question 14) | **e-Lat** (Question banks & item response logs) | **Horizontal Bar Chart** (two color series: correct vs. incorrect response rates per question) *(replaces Diverging Bar Chart, which is not natively supported in Superset)* | Bottom Half (Left Side of Sortable Question Table) |
| Time spent on question vs. final score | **e-Lat** (Time spent per question & final question scores) | **Scatter Chart** | Expandable Question Detail Drawer / Side Panel |
| Question difficulty ranking table | **e-Lat** (Question bank difficulty indices) | **Table** (sortable) | Bottom Half (Split-Horizontal View) |

---

## 11. Attendance Analytics

* **Data Required from SIMRS:** Institutional attendance policies and scholarship/financial aid compliance thresholds, mandatory attendance rules per military service regulations.
* **Data Required from e-Lat:** Daily check-in logs, virtual lecture join/leave times (e.g., video conference integration), instructor-marked attendance records.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Training period attendance patterns and high-absence day clusters | **SIMRS** (Academic/training calendar dates) + **e-Lat** (Daily check-in logs, virtual join/leave times) | **Calendar Chart** (Darker shades = higher absence days) | Main Screen Area (Dominant Calendar-Centric View) |
| Presence/absence trends tracked over the training period | **e-Lat** (Daily attendance logs & lecture telemetry) | **Area Chart** (stacked mode) | Below or Embedded within Calendar View |
| Auto-generated list of cadets missing 3 consecutive sessions (flagged for disciplinary/administrative review) | **SIMRS** (Attendance compliance thresholds per military service regulations) + **e-Lat** (Consecutive absence logs) | **Table** with conditional color formatting (rows flagged red when absence threshold is exceeded) *(replaces Flagged Cadet List Card, which is a UI component outside Superset's chart scope)* | Sidebar Panel (Right Side of Screen) |

---

## 12. Participation Analytics

* **Data Required from SIMRS:** Official cadet subject roster.
* **Data Required from e-Lat:** Video player telemetry (play/pause/scrub), discussion board post counts, file/material download logs, page view timestamps.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (SIMRS / e-Lat) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Lecture video watch percentage vs. corresponding weekly quiz score | **e-Lat** (Video player scrub telemetry & weekly quiz scores) | **Area Chart / Scatter Chart Overlay** | Cadet Detail Drawer / Expanded Row View |
| Forum participation and cadet interaction dynamics | **e-Lat** (Discussion board post/reply counts & author interactions) | **Heatmap** (cadets on both axes, cell intensity = reply-count between pairs) *(replaces Network Graph, which is not natively supported in Superset)* | Analytics Overview Drawer |
| 7-day individual cadet engagement trends | **e-Lat** (File download logs, page view timestamps) | **Big Number with Trendline** (one panel per cadet showing 7-day trend) *(replaces Inline Sparklines; Superset cannot embed sparklines inside table rows natively)* | Embedded panel grid per cadet in the Cadet Roster section |
| Cadet roster & engagement summary | **SIMRS** (Official cadet roster) + **e-Lat** (Aggregated engagement metrics) | **Table** (roster-based layout) | Main Body Workspace |
