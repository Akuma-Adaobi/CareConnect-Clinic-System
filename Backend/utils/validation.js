const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::\d{2})?$/;
const CLINIC_TIME_ZONE = process.env.CLINIC_TIME_ZONE || 'Africa/Lagos';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalizePhone(value) {
  return cleanText(value).replace(/[\s()-]/g, '');
}

function isValidEmail(value) {
  return value.length <= 100 && EMAIL_PATTERN.test(value);
}

function isValidPhone(value) {
  return /^\+?\d{10,15}$/.test(value);
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function datePartsInTimeZone(date = new Date(), timeZone = CLINIC_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function currentClinicDateTime(date = new Date()) {
  const parts = datePartsInTimeZone(date);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function normalizeTime(value) {
  const match = cleanText(value).match(TIME_PATTERN);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
}

function isPastDate(value) {
  return value < currentClinicDateTime().date;
}

function isPastDateTime(date, time) {
  const current = currentClinicDateTime();
  return date < current.date || (date === current.date && time <= current.time);
}

function sameId(left, right) {
  return String(left) === String(right);
}

module.exports = {
  cleanText,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  isValidDate,
  normalizeTime,
  isPastDate,
  isPastDateTime,
  currentClinicDateTime,
  sameId,
};
