# Proposed Candidate Experience & Zero-Scroll Layout

Here are the visual designs for the updated candidate experience. This resolves the screen-overflow issue by separating the flow into two clean, purpose-built screens that fit 100% into standard screens without any scrolling.

---

## Screen 1: Welcome & Job Overview (The First Page)

When candidates click their interview invitation link, they land here first. It gives them full clarity on the position and expectations before requesting camera or mic permissions.

![Screen 1 - Welcome & Job Overview](/assets/interview_welcome_screen_1794292892792.jpg)

### What Screen 1 Contains:
* **Position Details**: Job Title (e.g. *Junior AI Engineer*), concise job summary, and key skill chips.
* **Assessment Overview**: Number of questions, think time per question, and answer time limit.
* **Instructions & Integrity Guidelines**: Camera & mic requirements, quiet environment recommendation, and tab-switch integrity notice.
* **Expiration Deadline Banner**: Shows the active deadline timer.
* **Primary Action**: Prominent blue button: `Continue to Hardware Check →`.

---

## Screen 2: Zero-Scroll Split Viewport Layout (Device Check & Live Interview)

Once the candidate clicks continue, they enter the device setup and recording screen. Everything is arranged **side-by-side** so that the entire interface fits on screen at 100% zoom with **zero scrolling required**.

![Screen 2 - Zero-Scroll Split Layout](/assets/viewport_interview_layout_1794292915743.jpg)

### What Screen 2 Contains:
* **Left Column (Compact Control Card)**:
  * Current question text & countdown timers (e.g., *Question 1 of 3: "Describe a challenging machine learning project..."*).
  * Audio verification: Real-time visual microphone meter + "Test Mic" & "Test Speaker" buttons.
  * Primary Action Buttons:
    * Before Interview: `Try Practice Question` and `Start Real Interview →`
    * During Interview: `Record Answer Now`, `Finish & Next Question`, and `Submit Recording`
* **Right Column (16:9 Video Box)**:
  * Webcam preview with camera and microphone toggle pills.
  * Clean, distraction-free recording area.

### Key Benefits:
1. **Zero Scroll Needed**: Both the question, the camera, and the action buttons are 100% visible on any standard 1366x768 or 1080p laptop display.
2. **Never Miss the Submit Button**: Candidates will never have to hunt or scroll down to find the submit or next question buttons.
