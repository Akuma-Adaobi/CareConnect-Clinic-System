const {
  isValidDate,
  normalizeTime,
  isPastDate,
  isPastDateTime,
} = require('./validation');

const WORKING_HOURS = {
  start: '09:00',
  end: '17:00',
  slotMinutes: 30,
  daysOff: [0],
};

function timeToMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function generateDaySlots() {
  const slots = [];
  const end = timeToMinutes(WORKING_HOURS.end);

  for (
    let time = timeToMinutes(WORKING_HOURS.start);
    time < end;
    time += WORKING_HOURS.slotMinutes
  ) {
    slots.push(minutesToTime(time));
  }

  return slots;
}

function isDayOff(date) {
  return WORKING_HOURS.daysOff.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
}

function validateAppointmentSlot(date, rawTime) {
  if (!isValidDate(date)) {
    return { valid: false, message: 'Date must use the YYYY-MM-DD format' };
  }

  const time = normalizeTime(rawTime);
  if (!time) {
    return { valid: false, message: 'Time must use the HH:MM format' };
  }

  if (isPastDate(date)) {
    return { valid: false, message: 'Appointments cannot be booked in the past' };
  }

  if (isDayOff(date)) {
    return { valid: false, message: 'The clinic is closed on Sundays' };
  }

  if (!generateDaySlots().includes(time)) {
    return { valid: false, message: 'Please choose one of the available clinic time slots' };
  }

  if (isPastDateTime(date, time)) {
    return { valid: false, message: 'That appointment time has already passed' };
  }

  return { valid: true, time };
}

function availableSlotsForDate(date, bookedTimes) {
  const booked = new Set(bookedTimes.map((time) => normalizeTime(time)).filter(Boolean));
  return generateDaySlots().filter(
    (time) => !booked.has(time) && !isPastDateTime(date, time)
  );
}

module.exports = {
  WORKING_HOURS,
  generateDaySlots,
  isDayOff,
  validateAppointmentSlot,
  availableSlotsForDate,
};
