/** YYYY-MM-DD in the device's local time zone. toISOString() is UTC, which is still yesterday before 8am in Manila. */
export const localDateString = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
