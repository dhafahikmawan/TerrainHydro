# Analytics & Decision Support System Specifications

This document outlines the detailed specifications for the Analytics & Decision Support Portal, including data requirements, explicit mappings between data items and chart types, exact data sources (AIS vs. LMS), and their placement within the UI layout for each analytical view.

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

* **Data Required from AIS:** User role/permissions, current term dates, academic standing statuses, global broadcast alerts.
* **Data Required from LMS:** Count of ungraded assignments, unread messages, recent course announcements.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Academic standing summary & probation counts | **AIS** (Academic standing statuses, probation records) | **Numeric Scorecards** (with Red/Yellow/Green status indicators) | Top Row (Horizontal "Big Number" Scorecards) |
| Ungraded assignments & faculty grading pending tasks | **LMS** (Ungraded assignment counts, faculty task queues) | **Donut Charts** (completion percentages) | Main Body (Modular Drag-and-Drop Grid Column 1) |
| Student engagement & course activity trends | **LMS** (Weekly active time, course access logs) | **Sparklines** (mini trend lines) | Main Body (Modular Drag-and-Drop Grid Column 2) |
| System-wide alerts & global broadcasts (e.g., *"Spring Registration opens in 48 hours"*) | **AIS & LMS** (Registration dates, system announcements) | **Notification Badge / Action List Cards** | Persistent Slide-Out Right Panel |

---

## 2. Integrated Data Analysis

* **Data Required from AIS:** Pell Grant/financial aid status, demographic markers, declared major, current GPA.
* **Data Required from LMS:** Login timestamps, total engagement time in minutes, module completion rates.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Dimension controls (Axis selection for Aid status, Major, GPA vs LMS Engagement) | **AIS** (Major, GPA, Financial Aid) + **LMS** (Engagement Mins) | **Form Controls / Filter Dropdowns** | Left 25% (Vertical Control Pane) |
| Financial aid dependency vs. average weekly LMS engagement time (identifying funding risk) | **AIS** (Financial Aid Status) + **LMS** (Weekly Engagement Mins) | **Scatter Plot** (Correlation analysis) | Right 75% (Top Section of Main Interactive Canvas) |
| Correlation incorporating 3rd variable (e.g., course size or GPA alongside aid vs. engagement) | **AIS** (GPA, Course Size) + **LMS** (Engagement Mins) | **Bubble Chart** | Right 75% (Toggle view on Main Interactive Canvas) |
| Engagement patterns across modules/days | **LMS** (Daily login timestamps, module completion logs) | **Complex Heatmap** | Right 75% (Alternative View / Detail Section of Canvas) |
| Underlying student-level detailed metrics | **AIS** (Student profile, Major, GPA) + **LMS** (Total engagement time) | **Sortable Data Table** | Right 75% (Bottom Section below Canvas) |

---

## 3. Decision Support Dashboard

* **Data Required from AIS:** Midterm grades, missed advising appointments, outstanding tuition balances.
* **Data Required from LMS:** Recent sharp drops in assignment submissions, prolonged absences from course modules.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Prioritized top 25 students with >80% predictive probability of dropping out + *"Schedule Intervention"* action button | **AIS** (Midterm grades, missed advising) + **LMS** (Assignment submission drops) | **Prioritized "To-Do" Action List Table** | Main Body (Primary Action-Oriented Workflow View) |
| Predictive dropout risk levels & threshold indicators | **AIS & LMS** (Combined predictive AI model outputs) | **Gauge Charts** (Risk Levels) | Expandable Right Side Panel (Top Section) |
| Target vs. actual academic performance indicators (grades, submission rates) | **AIS** (Target vs actual grades) + **LMS** (Submission rates) | **Bullet Graphs** (Performance vs. Target) | Expandable Right Side Panel (Middle Section) |
| Logical rule path justifying recommendation (e.g., missed appointments + dropped grades) | **AIS** (Advising records, midterm grades) + **LMS** (Absence logs) | **Decision Tree Visualization** | Expandable Right Side Panel (Bottom Section) |

---

## 4. Executive Decision View

* **Data Required from AIS:** Aggregate registration counts, tuition billing totals, historical cohort enrollment data, accreditation tracking statuses.
* **Data Required from LMS:** *(Minimal)* Aggregate system adoption rates across different colleges.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Current term Full-Time Equivalent (FTE) enrollment against targets, YTD tuition revenue, freshman retention rates | **AIS** (Registration counts, tuition billing totals, retention records) | **High-Level Scorecards** (Large numbers with % change indicators) | Top Header / Row 1 (High Contrast Layout) |
| Geographic enrollment distribution | **AIS** (Student address, zip code, state of origin) | **Choropleth Map** | Main Body (Left Grid Widget) |
| Tuition revenue and FTE breakdown across colleges | **AIS** (Tuition billing, major/college breakdown) + **LMS** (Adoption rates) | **Stacked Column Chart** | Main Body (Right Grid Widget) |

---

## 5. Operational Decision View

* **Data Required from AIS:** Real-time course registration and waitlist numbers, classroom scheduling and capacity matrix.
* **Data Required from LMS:** Active concurrent users, server latency, and uptime metrics.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Daily classroom seat utilization & server load capacity limits | **AIS** (Classroom seat capacity) + **LMS** (Server load limits) | **Bar Charts** (Actual usage vs. maximum capacity) | Top Widget Row (Command Center Grid) |
| Real-time course registration progress towards target enrollment | **AIS** (Live course registration logs) | **Progress Bars** | Header / Summary Bar |
| Live concurrent users, server latency, and system uptime | **LMS** (Active session telemetry, server uptime logs) | **Real-Time Updating Line Charts** | Middle Grid Section |
| Real-time waitlist counts for bottleneck 100-level courses | **AIS** (Waitlist counts, course registration queues) | **Sortable Data Table** (with color-coded status badges) | Main Lower Command Center View (Auto-refreshes every few minutes) |

---

## 6. Trend Analysis

* **Data Required from AIS:** Historical major declarations and credit hours generated per department over 10+ semesters.
* **Data Required from LMS:** Historical shifts in course delivery methods (online vs. hybrid vs. on-premise course shells).

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| 5-year trajectory comparing declining humanities enrollment vs. surging data science/nursing registrations | **AIS** (Historical major declarations over 10+ semesters) | **Multi-Series Line Chart** | Center Main Stage (Wide Horizontal Layout) |
| Credit hour volume over time across departments | **AIS** (Departmental credit hours generated) | **Area Chart** | Main Canvas (View Toggle Option) |
| Cumulative positive/negative shifts in major declarations | **AIS** (Major transfer/declaration shifts) | **Waterfall Chart** | Main Canvas (View Toggle Option) |
| Timeframe zoom controller (semesters/years) | **AIS & LMS** (Semester/Year timeline metadata) | **Master Timeline Slider** | Bottom persistent bar under the main chart |

---

## 7. Historical Analysis

* **Data Required from AIS:** Graduated student records, demographic flags (first-gen, gender, income bracket), entrance year, degree conferral dates.
* **Data Required from LMS:** Historical aggregate course outcomes and completion rates.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Side-by-side comparison of 4-year graduation rates (Fall 2018 vs. Fall 2019 cohorts isolated by first-gen status) | **AIS** (Graduated records, entrance year, first-gen status) | **Grouped Bar Chart** | Upper Half of Split View (Dataset A on Left 50% vs. Dataset B on Right 50%) |
| Student flow, retention, and attrition points over 4 years | **AIS** (Cohort retention & conferral) + **LMS** (Aggregate course outcomes) | **Sankey Diagram** | Lower Half of Split View (Dataset A on Left 50% vs. Dataset B on Right 50%) |

---

## 8. Readiness Analysis

* **Data Required from AIS:** Student transcripts, prerequisite logic tree for courses, faculty credential database.
* **Data Required from LMS:** Pre-assessment or placement test scores completed before term start.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Percentage of enrolled students in Advanced Course A completing Course C prerequisite (grade C or better) | **AIS** (Student transcripts & prerequisite logic tree) | **Radial Progress Bar** | Top Overview / Summary Card |
| Mapping student incoming skills vs. required course competencies | **AIS** (Transcripts) + **LMS** (Pre-assessment placement test scores) | **Radar / Spider Chart** | Matrix Panel Side Widget |
| Prerequisites and accreditation requirements fulfillment per student/faculty | **AIS** (Prerequisite tree & faculty credentials) + **LMS** (Placement test completions) | **Matrix Grid View** (Rows = entities, Columns = requirements, Cells = checkmark, red 'X', or %) | Central Matrix Workspace |

---

## 9. Performance Analysis

* **Data Required from AIS:** Final grades, withdrawal timestamps, instructor assignments per section.
* **Data Required from LMS:** Aggregated teaching evaluation scores and end-of-term student survey results.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| DFW (Drop/Fail/Withdraw) rate for Biology 101 compared across 5 instructors | **AIS** (Final grades, withdrawal timestamps, instructor section assignments) | **Box-and-Whisker Plot** (shows grade variance & outliers) | Primary View of Tiered Drill-Down (Drills from College → Dept → Course → Section) |
| Grade curve distributions per section/instructor | **AIS** (Final grade distributions per section) | **Histogram** | Detail Section in Tiered Drill-Down |
| End-of-term student teaching evaluation scores per instructor | **LMS** (Aggregated teaching evaluation survey scores) | **Horizontal Bar Chart** | Side-by-side comparison card in Section Drill-Down |

---

## 10. Assessment Analytics

* **Data Required from AIS:** Official student course roster.
* **Data Required from LMS:** Question banks, individual student test responses, time spent per question, rubric criteria scores.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Class score distribution on midterm exam | **AIS** (Official roster) + **LMS** (Individual test response scores) | **Bell Curve / Distribution Chart** | Top Half (Split-Horizontal View) |
| Exam item analysis (e.g., alert showing 82% selected identical distractor on Question 14) | **LMS** (Question banks & item response logs) | **Diverging Bar Chart** (Correct vs. incorrect answers per question) | Bottom Half (Left Side of Sortable Question Table) |
| Time spent on question vs. final score | **LMS** (Time spent per question & final question scores) | **Scatter Plot** | Expandable Question Detail Drawer / Side Panel |
| Question difficulty ranking table | **LMS** (Question bank difficulty indices) | **Sortable Data Table** | Bottom Half (Split-Horizontal View) |

---

## 11. Attendance Analytics

* **Data Required from AIS:** Institutional attendance policies and financial aid compliance thresholds.
* **Data Required from LMS:** Daily check-in logs, virtual lecture join/leave times (e.g., Zoom integration), instructor-marked attendance records.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Semester attendance patterns and high-absence day clusters | **AIS** (Academic calendar dates) + **LMS** (Daily check-in logs, virtual join/leave times) | **Calendar Heatmap** (Darker shades = higher absence days) | Main Screen Area (Dominant Calendar-Centric View) |
| Presence/absence trends tracked over the semester | **LMS** (Daily attendance logs & lecture telemetry) | **Stacked Area Chart** | Below or Embedded within Calendar View |
| Auto-generated list of students missing 3 consecutive classes (flagged for financial aid review) | **AIS** (Financial aid compliance thresholds) + **LMS** (Consecutive absence logs) | **Flagged Student List Card / Data Table** | Sidebar Panel (Right Side of Screen) |

---

## 12. Participation Analytics

* **Data Required from AIS:** Official course roster.
* **Data Required from LMS:** Video player telemetry (play/pause/scrub), discussion board post counts, file download logs, page view timestamps.

### Chart & Layout Mapping Matrix

| Specific Data Shown | Data Source (AIS / LMS) | Chart / Visualization Used | Layout Placement |
| :--- | :--- | :--- | :--- |
| Lecture video watch percentage vs. corresponding weekly quiz score | **LMS** (Video player scrub telemetry & weekly quiz scores) | **Area Chart / Scatter Overlay** | Student Detail Drawer / Expanded Row View |
| Forum participation and student interaction dynamics | **LMS** (Discussion board post/reply counts & author interactions) | **Network Graph** (Visualizes who replies to whom in forums) | Analytics Overview Drawer |
| 7-day individual student engagement trends | **LMS** (File download logs, page view timestamps) | **Inline Sparklines** | Embedded directly into each row of the Student Roster List |
| Student roster & engagement summary | **AIS** (Official course roster) + **LMS** (Aggregated engagement metrics) | **Roster-Based Table Layout** | Main Body Workspace |
