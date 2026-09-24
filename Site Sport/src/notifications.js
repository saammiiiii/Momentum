import { useEffect } from "react";
import { dailyWater, plannedProgram, today } from "./calculations";
import { sendNotification } from "./context";
import { useAuth } from "./auth";
export function useReminders(state, notify) {
  const { user } = useAuth();
  useEffect(() => {
    if (!state?.onboardingComplete) return;
    function check() {
      const now = new Date(),
        date = today(),
        minutes = now.getHours() * 60 + now.getMinutes();
      Object.entries(state.reminders).forEach(([key, r]) => {
        if (!r.enabled) return;
        const [hours, mins] = r.time.split(":").map(Number);
        if (minutes < hours * 60 + mins) return;
        const program = plannedProgram(state, date);
        const exceptional = Object.prototype.hasOwnProperty.call(
          state.exceptions,
          date,
        );
        if (
          key === "training" &&
          (!program || (!exceptional && !r.days.includes(now.getDay())))
        )
          return;
        if (
          key === "water" &&
          dailyWater(state, date) >= state.profile.waterGoal
        )
          return;
        if (key !== "training" && !r.days.includes(now.getDay())) return;
        if (
          key === "creatine" &&
          (!state.profile.trackCreatine || state.supplements[date]?.creatine)
        )
          return;
        if (
          key === "whey" &&
          (!state.profile.trackWhey || state.supplements[date]?.whey)
        )
          return;
        if (
          key === "training" &&
          state.sessions.some(
            (s) => s.date === date && s.programId === program.id,
          )
        )
          return;
        const storageKey = `momentum-reminder:${user?.id || "local"}:${date}:${key}`;
        try {
          if (localStorage.getItem(storageKey)) return;
          localStorage.setItem(storageKey, "1");
        } catch {
          return;
        }
        const body =
          key === "training"
            ? `Séance ${program.name} aujourd’hui. À votre rythme.`
            : key === "creatine"
              ? "Avez-vous pris votre créatine aujourd’hui ?"
              : key === "water"
                ? dailyWater(state, date) === 0
                  ? "Pensez à boire de l’eau aujourd’hui."
                  : "Vous êtes encore loin de votre objectif d’hydratation."
                : "Votre shaker est-il pris aujourd’hui ?";
        notify(body, "info");
        if (r.type === "system")
          sendNotification("Momentum · Votre rappel", body);
      });
    }
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [state, notify, user?.id]);
}
export function downloadFile(name, contents, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCalendar(state) {
  const esc = (value) =>
    String(value)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Momentum//Programme personnel//FR",
    "CALSCALE:GREGORIAN",
  ];
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const p = plannedProgram(state, date);
    if (!p) continue;
    const [hh, mm] = state.scheduleTime.split(":");
    const stamp = date.replaceAll("-", "") + "T" + hh + mm + "00";
    lines.push(
      "BEGIN:VEVENT",
      `UID:momentum-${date}-${p.id}@local`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
      `DTSTART:${stamp}`,
      "DURATION:PT1H",
      `SUMMARY:${esc("Momentum · " + p.name)}`,
      `DESCRIPTION:${esc(p.exercises.map((e) => state.exercises.find((x) => x.id === e.exerciseId)?.name || "Exercice").join("\n"))}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(p.name + " dans 15 minutes")}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  downloadFile(
    "momentum-programme-90-jours.ics",
    lines.join("\r\n"),
    "text/calendar;charset=utf-8",
  );
}
