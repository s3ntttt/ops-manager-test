# ✈️ OPS Manager — Shift Operations Management System

A real-time web application built for airline ground operations teams to manage daily shift manpower, allocations, and operational briefings.

> **Built for Batik Air KUL · Shift C Ground Operations**

---

## 🚀 What It Does

### 📋 Live Roster Management
- Pulls live staff data directly from **Google Sheets** roster
- Automatically parses staff by department — Line Ops, Irregularities, Work Order, CIM, MOC
- Detects staff availability: Working, AL/OFF, MC/EL, Flying Duty, Course, Standby

### 👥 Manpower Tracking
- Real-time headcount per department and category (LAE B1/B2, LAT, TECH)
- Availability breakdown — MC/EL, AL/OFF, CRS/PRO, Flying
- Half-shift staff counted as 0.5 automatically
- Flying-on-duty staff counted as 0.5 in availability

### 🔧 Role Allocation
- Assign MOC, MOJO, Wheel Crew, Runners, Tower crew
- Slip Shift (SS) assignment for Line Ops Technicians (up to 3)
- Acting Group Leader assignment per department
- Staff swap and transfer between departments
- Backup staff management across all departments

### 📤 Operational Briefing Generator
- One-click generation of the daily shift briefing text
- Auto-formatted for WhatsApp sharing
- Includes SS timing, role assignments, cross-shift backups
- Flags half-shift `(1/2 DAY/NIGHT)`, flying duty `*`, and timing overrides

### ☁️ Cloud Sync
- All allocations saved to **Firebase Realtime Database**
- Instant sync across multiple devices — update on one device, see on all
- localStorage backup for offline resilience
- Per-shift data isolation — each date/shift/group has its own saved state

### 🔒 Access Control
- Team access code protected
- JWT session tokens (12-hour expiry)
- All API keys server-side — never exposed to browser

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single-page app) |
| Backend | Node.js + Express |
| Database | Firebase Realtime Database |
| Auth | JWT + team access code |
| Roster Source | Google Sheets API (proxied) |
| Hosting | Railway |
| Version Control | GitHub |

---

## 📸 Features At a Glance

- ✅ Multi-shift support (DAY / NIGHT) with shift groups A/B/C/D
- ✅ ENG Specialist Team with dedicated badges
- ✅ Cross-shift backup detection
- ✅ Role conflict detection and warnings
- ✅ SOC / PDSC / FGS / OPS inputs
- ✅ Hidden staff management
- ✅ Debug panel for roster diagnostics
- ✅ Reset function per date/shift

---

## 💡 Interested in a Similar System?

This system was custom-built for airline ground operations shift management. If you're interested in a similar solution for your team or organisation, feel free to reach out.

📧 **wilsent75@gmail.com**

---

## ⚖️ Copyright

Copyright (c) 2026 Wilsent. All rights reserved.  
This software is proprietary. Unauthorised copying or distribution is prohibited.
